"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseBsysRawFile, type BsysRawRow } from "@/lib/bsys-raw-parser";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

type ImportBsysResult =
  | { success: true; informeId: string; cantidadMes: number; cantidadAcumulado: number }
  | { error: string; cuentasFaltantes?: string[] };

export async function importBsysCombinado(formData: FormData): Promise<ImportBsysResult> {
  const empresaId = Number(formData.get("empresaId"));
  const periodoMes = Number(formData.get("periodoMes"));
  const periodoAnio = Number(formData.get("periodoAnio"));
  const archivoMes = formData.get("archivoMes");
  const archivoAcumulado = formData.get("archivoAcumulado");

  if (!Number.isInteger(periodoMes) || periodoMes < 1 || periodoMes > 12) {
    return { error: "Mes inválido." };
  }
  if (!Number.isInteger(periodoAnio) || periodoAnio < 2000) {
    return { error: "Año inválido." };
  }
  if (!(archivoMes instanceof File) || archivoMes.size === 0) {
    return { error: "Seleccioná el archivo de BSyS del Mes." };
  }
  if (!(archivoAcumulado instanceof File) || archivoAcumulado.size === 0) {
    return { error: "Seleccioná el archivo de BSyS Acumulado." };
  }

  const [htmlMes, htmlAcumulado] = await Promise.all([
    archivoMes.text(),
    archivoAcumulado.text(),
  ]);
  const rowsMes = parseBsysRawFile(htmlMes);
  const rowsAcumulado = parseBsysRawFile(htmlAcumulado);

  if (rowsMes.length === 0) {
    return {
      error:
        "No se encontraron cuentas en el archivo de BSyS del Mes. Verificá que sea el export correcto del sistema contable.",
    };
  }
  if (rowsAcumulado.length === 0) {
    return {
      error:
        "No se encontraron cuentas en el archivo de BSyS Acumulado. Verificá que sea el export correcto del sistema contable.",
    };
  }

  // Se compara por forma normalizada (mayúsculas/espacios): el mismo nombre de
  // cuenta puede venir con distinto casing entre el Plan de Cuentas (importado
  // desde HOJA LLAVE) y el export del sistema contable.
  const clasificadas = await prisma.planDeCuentas.findMany({
    where: { empresaId },
    select: { cuenta: true },
  });
  const clasificadasSet = new Set(clasificadas.map((p) => normalizeCuenta(p.cuenta)));

  const cuentasArchivo = new Set([
    ...rowsMes.map((r) => r.cuenta),
    ...rowsAcumulado.map((r) => r.cuenta),
  ]);
  const faltantes = [...cuentasArchivo].filter((c) => !clasificadasSet.has(normalizeCuenta(c)));

  if (faltantes.length > 0) {
    return {
      error: `Hay ${faltantes.length} cuenta(s) en los archivos que no están en el Plan de Cuentas de esta empresa. Agregalas en Configuración → Plan de Cuentas y reintentá.`,
      cuentasFaltantes: faltantes,
    };
  }

  // Un mismo timestamp para todas las filas de cada tipo: computeInformeReport
  // agrupa "la carga más reciente" por fechaCarga exacta, así que calcular
  // new Date() por fila (en vez de una vez por carga) partiría el archivo en
  // más de un batch si el insert cruza un límite de milisegundo.
  const fechaCarga = new Date();

  const toData = (rows: BsysRawRow[], tipo: "MES" | "ACUMULADO") =>
    rows.map((r) => ({
      empresaId,
      tipo,
      fechaCarga,
      cuenta: r.cuenta,
      saldoIniDebe: r.saldoIniDebe,
      saldoIniHaber: r.saldoIniHaber,
      sumasDebe: r.sumasDebe,
      sumasHaber: r.sumasHaber,
      saldoCierreDebe: r.saldoCierreDebe,
      saldoCierreHaber: r.saldoCierreHaber,
    }));

  const informe = await prisma.$transaction(async (tx) => {
    await tx.balanceSumasYSaldos.createMany({ data: toData(rowsMes, "MES") });
    await tx.balanceSumasYSaldos.createMany({ data: toData(rowsAcumulado, "ACUMULADO") });
    return tx.informe.upsert({
      where: { empresaId_periodoMes_periodoAnio: { empresaId, periodoMes, periodoAnio } },
      update: {},
      create: { empresaId, periodoMes, periodoAnio },
    });
  });

  revalidatePath(`/empresa/${empresaId}/confeccionar-informe`);
  revalidatePath(`/empresa/${empresaId}/historico`);

  return {
    success: true,
    informeId: informe.id,
    cantidadMes: rowsMes.length,
    cantidadAcumulado: rowsAcumulado.length,
  };
}
