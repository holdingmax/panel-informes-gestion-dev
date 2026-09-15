"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseBsysRawFile, type BsysRawRow } from "@/lib/bsys-raw-parser";
import { normalizeCuenta } from "@/lib/cuenta-normalize";
import { verificarSeriesCompletaHasta } from "@/lib/series-e-indices-actions";

type ImportBsysResult =
  | {
      success: true;
      informeId: string;
      detalle: { empresaNombre: string; cantidadMes: number; cantidadAcumulado: number }[];
    }
  | { error: string; empresaNombre?: string; cuentasFaltantes?: string[] };

// Una Unidad de Negocio puede combinar varias Empresas, cada una con su
// propio Plan de Cuentas y por lo tanto su propio par de archivos BSyS
// (Mes y Acumulado) — todas para el mismo período, consolidadas en un solo
// Informe. Los archivos llegan con nombres de campo "archivoMes_<codEmp>" y
// "archivoAcumulado_<codEmp>" por cada empresa vinculada.
export async function importBsysCombinado(formData: FormData): Promise<ImportBsysResult> {
  const unidadNegocioId = Number(formData.get("unidadNegocioId"));
  const periodoMes = Number(formData.get("periodoMes"));
  const periodoAnio = Number(formData.get("periodoAnio"));
  const empresaIds = formData.getAll("empresaId").map(Number);

  if (!Number.isInteger(periodoMes) || periodoMes < 1 || periodoMes > 12) {
    return { error: "Mes inválido." };
  }
  if (!Number.isInteger(periodoAnio) || periodoAnio < 2000) {
    return { error: "Año inválido." };
  }
  if (empresaIds.length === 0) {
    return {
      error:
        "Esta unidad de negocio no tiene empresas vinculadas. Vinculá al menos una en Configuración → Unidades de Negocio.",
    };
  }

  const seriesError = await verificarSeriesCompletaHasta(
    new Date(Date.UTC(periodoAnio, periodoMes - 1, 1))
  );
  if (seriesError) {
    return {
      error: `${seriesError} Completá Configuración → Series e Índices antes de cargar este período.`,
    };
  }

  const empresas = await prisma.empresa.findMany({
    where: { codEmp: { in: empresaIds }, unidadNegocioId },
  });
  if (empresas.length !== empresaIds.length) {
    return { error: "Alguna de las empresas indicadas ya no está vinculada a esta unidad de negocio. Recargá la página." };
  }

  type Parsed = {
    empresaId: number;
    empresaNombre: string;
    rowsMes: BsysRawRow[];
    rowsAcumulado: BsysRawRow[];
  };
  const parsedPorEmpresa: Parsed[] = [];

  for (const empresa of empresas) {
    const archivoMes = formData.get(`archivoMes_${empresa.codEmp}`);
    const archivoAcumulado = formData.get(`archivoAcumulado_${empresa.codEmp}`);

    if (!(archivoMes instanceof File) || archivoMes.size === 0) {
      return { error: `Seleccioná el archivo de BSyS del Mes de "${empresa.nombreEmp}".` };
    }
    if (!(archivoAcumulado instanceof File) || archivoAcumulado.size === 0) {
      return { error: `Seleccioná el archivo de BSyS Acumulado de "${empresa.nombreEmp}".` };
    }

    const [htmlMes, htmlAcumulado] = await Promise.all([
      archivoMes.text(),
      archivoAcumulado.text(),
    ]);
    const rowsMes = parseBsysRawFile(htmlMes);
    const rowsAcumulado = parseBsysRawFile(htmlAcumulado);

    if (rowsMes.length === 0) {
      return {
        error: `No se encontraron cuentas en el archivo de BSyS del Mes de "${empresa.nombreEmp}". Verificá que sea el export correcto del sistema contable.`,
      };
    }
    if (rowsAcumulado.length === 0) {
      return {
        error: `No se encontraron cuentas en el archivo de BSyS Acumulado de "${empresa.nombreEmp}". Verificá que sea el export correcto del sistema contable.`,
      };
    }

    // Se compara por forma normalizada (mayúsculas/espacios): el mismo nombre
    // de cuenta puede venir con distinto casing entre el Plan de Cuentas
    // (importado desde HOJA LLAVE) y el export del sistema contable.
    const clasificadas = await prisma.planDeCuentas.findMany({
      where: { empresaId: empresa.codEmp },
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
        error: `Hay ${faltantes.length} cuenta(s) de "${empresa.nombreEmp}" que no están en su Plan de Cuentas. Agregalas en Configuración → Plan de Cuentas y reintentá.`,
        empresaNombre: empresa.nombreEmp,
        cuentasFaltantes: faltantes,
      };
    }

    parsedPorEmpresa.push({
      empresaId: empresa.codEmp,
      empresaNombre: empresa.nombreEmp,
      rowsMes,
      rowsAcumulado,
    });
  }

  // Un mismo timestamp para todas las filas de todas las empresas de esta
  // carga: computeInformeReport agrupa "la carga más reciente" por
  // fechaCarga exacta, así que calcular new Date() por fila (en vez de una
  // vez por carga) partiría el archivo en más de un batch si el insert
  // cruza un límite de milisegundo.
  const fechaCarga = new Date();

  const toData = (rows: BsysRawRow[], tipo: "MES" | "ACUMULADO", empresaId: number) =>
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

  const informeId = await prisma.$transaction(async (tx) => {
    for (const p of parsedPorEmpresa) {
      await tx.balanceSumasYSaldos.createMany({ data: toData(p.rowsMes, "MES", p.empresaId) });
      await tx.balanceSumasYSaldos.createMany({
        data: toData(p.rowsAcumulado, "ACUMULADO", p.empresaId),
      });
    }
    const informe = await tx.informe.upsert({
      where: { unidadNegocioId_periodoMes_periodoAnio: { unidadNegocioId, periodoMes, periodoAnio } },
      update: {},
      create: { unidadNegocioId, periodoMes, periodoAnio },
    });
    return informe.id;
  });

  revalidatePath(`/empresa/${unidadNegocioId}/confeccionar-informe`);
  revalidatePath(`/empresa/${unidadNegocioId}/historico`);

  return {
    success: true,
    informeId,
    detalle: parsedPorEmpresa.map((p) => ({
      empresaNombre: p.empresaNombre,
      cantidadMes: p.rowsMes.length,
      cantidadAcumulado: p.rowsAcumulado.length,
    })),
  };
}
