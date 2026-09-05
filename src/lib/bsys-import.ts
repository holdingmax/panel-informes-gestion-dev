"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseBsysRawFile } from "@/lib/bsys-raw-parser";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

export async function importBsys(formData: FormData) {
  const empresaId = Number(formData.get("empresaId"));
  const tipo = formData.get("tipo") === "ACUMULADO" ? "ACUMULADO" : "MES";
  const periodoMes = Number(formData.get("periodoMes"));
  const periodoAnio = Number(formData.get("periodoAnio"));
  const file = formData.get("archivo");

  if (!Number.isInteger(periodoMes) || periodoMes < 1 || periodoMes > 12) {
    return { error: "Mes inválido." };
  }
  if (!Number.isInteger(periodoAnio) || periodoAnio < 2000) {
    return { error: "Año inválido." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleccioná un archivo." };
  }

  const html = await file.text();
  const rows = parseBsysRawFile(html);

  if (rows.length === 0) {
    return {
      error: "No se encontraron cuentas en el archivo. Verificá que sea el export correcto del sistema contable.",
    };
  }

  // Se compara por forma normalizada (mayúsculas/espacios): el mismo nombre de
  // cuenta puede venir con distinto casing entre el Plan de Cuentas (importado
  // desde HOJA LLAVE) y el export mensual del sistema contable.
  const clasificadas = await prisma.planDeCuentas.findMany({
    where: { empresaId },
    select: { cuenta: true },
  });
  const clasificadasSet = new Set(clasificadas.map((p) => normalizeCuenta(p.cuenta)));
  const faltantes = rows
    .map((r) => r.cuenta)
    .filter((c) => !clasificadasSet.has(normalizeCuenta(c)));

  if (faltantes.length > 0) {
    return {
      error: `Hay ${faltantes.length} cuenta(s) del archivo que no están en el Plan de Cuentas de esta empresa. Agregalas en Configuración → Plan de Cuentas y reintentá.`,
      cuentasFaltantes: faltantes,
    };
  }

  // Un mismo timestamp para todas las filas del batch: computeInformeReport
  // agrupa "la carga más reciente" por fechaCarga exacta, así que calcular
  // new Date() por fila (en vez de una vez por carga) partiría el archivo en
  // más de un batch si el insert cruza un límite de milisegundo.
  const fechaCarga = new Date();

  await prisma.balanceSumasYSaldos.createMany({
    data: rows.map((r) => ({
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
    })),
  });

  await prisma.informe.upsert({
    where: { empresaId_periodoMes_periodoAnio: { empresaId, periodoMes, periodoAnio } },
    update: {},
    create: { empresaId, periodoMes, periodoAnio },
  });

  revalidatePath(`/empresa/${empresaId}/bsys-${tipo === "MES" ? "mes" : "acumulado"}`);
  revalidatePath(`/empresa/${empresaId}/historico`);
  return { success: true as const, cantidad: rows.length };
}
