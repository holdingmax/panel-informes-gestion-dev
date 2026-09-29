"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

export async function listResultadosHistoricos(unidadNegocioId: number) {
  await requireUser();
  return prisma.resultadosHistoricos.findMany({
    where: { unidadNegocioId },
    orderBy: [{ periodoAnio: "desc" }, { periodoMes: "desc" }],
  });
}

function parsePeriodoMM_AAAA(value: string): { periodoMes: number; periodoAnio: number } | null {
  const match = /^(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const periodoMes = Number(match[1]);
  const periodoAnio = Number(match[2]);
  if (periodoMes < 1 || periodoMes > 12) return null;
  return { periodoMes, periodoAnio };
}

function parseCampos(formData: FormData) {
  const campos = {
    ventas: Number(formData.get("ventas")),
    costosDirectos: Number(formData.get("costosDirectos")),
    gastosOperativos: Number(formData.get("gastosOperativos")),
    expensas: Number(formData.get("expensas")),
    otrasGananciasYPerdidas: Number(formData.get("otrasGananciasYPerdidas")),
  };
  for (const [campo, valor] of Object.entries(campos)) {
    if (!Number.isFinite(valor)) throw new Error(`El campo "${campo}" es inválido.`);
  }
  return campos;
}

export async function createResultadoHistorico(formData: FormData) {
  await requireAdmin();
  const unidadNegocioId = Number(formData.get("unidadNegocioId"));
  const periodo = parsePeriodoMM_AAAA(String(formData.get("periodo") ?? ""));
  if (!periodo) throw new Error('Período inválido. Usá el formato MM-AAAA (ej. "06-2026").');

  const existente = await prisma.resultadosHistoricos.findUnique({
    where: {
      unidadNegocioId_periodoMes_periodoAnio: {
        unidadNegocioId,
        periodoMes: periodo.periodoMes,
        periodoAnio: periodo.periodoAnio,
      },
    },
  });
  if (existente) {
    throw new Error(
      `Ya existe un período ${String(periodo.periodoMes).padStart(2, "0")}-${periodo.periodoAnio} cargado — editalo en vez de crear uno nuevo.`
    );
  }

  const campos = parseCampos(formData);
  await prisma.resultadosHistoricos.create({
    data: { unidadNegocioId, ...periodo, ...campos },
  });
  revalidatePath(`/empresa/${unidadNegocioId}/resultados-historicos`);
}

export async function updateResultadoHistorico(id: string, formData: FormData) {
  await requireAdmin();
  const campos = parseCampos(formData);
  const fila = await prisma.resultadosHistoricos.update({ where: { id }, data: campos });
  revalidatePath(`/empresa/${fila.unidadNegocioId}/resultados-historicos`);
}

export async function checkDeleteResultadoHistorico(): Promise<DeleteCheckResult> {
  await requireUser();
  // Nada más referencia esta fila por id — siempre se puede borrar.
  return { blocked: false };
}

export async function deleteResultadoHistorico(id: string) {
  await requireAdmin();
  const fila = await prisma.resultadosHistoricos.delete({ where: { id } });
  revalidatePath(`/empresa/${fila.unidadNegocioId}/resultados-historicos`);
}

const CAMPOS_POR_ETIQUETA: Record<
  string,
  "ventas" | "costosDirectos" | "gastosOperativos" | "expensas" | "otrasGananciasYPerdidas"
> = {
  ventas: "ventas",
  "costos directo de ventas": "costosDirectos",
  "costos directos": "costosDirectos",
  "costos fijos": "gastosOperativos",
  "gastos operativos": "gastosOperativos",
  expensas: "expensas",
  "otras ganancias y perdidas": "otrasGananciasYPerdidas",
  "otras ganancias y pérdidas": "otrasGananciasYPerdidas",
};

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v !== null && typeof v === "object" && "result" in v) return v.result;
  return v;
}

function normalizeEtiqueta(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function toPeriodo(value: unknown): Date | null {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  return null;
}

type ImportarResultado = {
  creados: number;
  omitidosPorConflicto: { periodoMes: number; periodoAnio: number }[];
  omitidosPorDatosIncompletos: number;
};

// Formato tabla estándar: fila 1 = encabezados de columna (columna 1 el
// período, el resto los nombres de los 5 campos, en cualquier orden — se
// reconocen por nombre, no por posición; columnas con un encabezado no
// reconocido, como un total de control, se ignoran). Filas 2 en adelante:
// una fila por período. Nunca pisa un período ya cargado — lo reporta como
// omitido y sigue con el resto.
export async function importarResultadosHistoricosExcel(
  formData: FormData
): Promise<ImportarResultado | { error: string }> {
  await requireAdmin();
  const unidadNegocioId = Number(formData.get("unidadNegocioId"));
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Seleccioná un archivo Excel." };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await archivo.arrayBuffer());
  const sheet = wb.worksheets[0];
  if (!sheet) return { error: "El archivo no tiene hojas." };

  const filaEncabezados = sheet.getRow(1);
  const campoPorColumna = new Map<
    number,
    "ventas" | "costosDirectos" | "gastosOperativos" | "expensas" | "otrasGananciasYPerdidas"
  >();
  for (let c = 2; c <= sheet.columnCount; c++) {
    const etiqueta = normalizeEtiqueta(String(cellValue(filaEncabezados.getCell(c)) ?? ""));
    const campo = CAMPOS_POR_ETIQUETA[etiqueta];
    if (campo) campoPorColumna.set(c, campo);
  }
  if (campoPorColumna.size === 0) {
    return {
      error:
        "No se reconoció ninguna columna en la fila 1 (Ventas, Costos Directos, Gastos Operativos, Expensas, Otras Ganancias y Pérdidas).",
    };
  }

  const valoresPorPeriodo = new Map<number, Partial<Record<string, number>>>();
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const periodo = toPeriodo(cellValue(row.getCell(1)));
    if (!periodo) continue;

    const valores: Partial<Record<string, number>> = {};
    for (const [c, campo] of campoPorColumna) {
      const valor = cellValue(row.getCell(c));
      if (valor === null || valor === undefined || valor === "") continue;
      valores[campo] = Number(valor);
    }
    valoresPorPeriodo.set(periodo.getTime(), valores);
  }

  const existentes = await prisma.resultadosHistoricos.findMany({
    where: { unidadNegocioId },
    select: { periodoMes: true, periodoAnio: true },
  });
  const existentesSet = new Set(existentes.map((e) => `${e.periodoAnio}-${e.periodoMes}`));

  let creados = 0;
  let omitidosPorDatosIncompletos = 0;
  const omitidosPorConflicto: { periodoMes: number; periodoAnio: number }[] = [];

  for (const [key, valores] of valoresPorPeriodo) {
    const periodo = new Date(key);
    const periodoMes = periodo.getUTCMonth() + 1;
    const periodoAnio = periodo.getUTCFullYear();

    const completo =
      valores.ventas !== undefined &&
      valores.costosDirectos !== undefined &&
      valores.gastosOperativos !== undefined &&
      valores.expensas !== undefined &&
      valores.otrasGananciasYPerdidas !== undefined;
    if (!completo) {
      omitidosPorDatosIncompletos++;
      continue;
    }

    if (existentesSet.has(`${periodoAnio}-${periodoMes}`)) {
      omitidosPorConflicto.push({ periodoMes, periodoAnio });
      continue;
    }

    await prisma.resultadosHistoricos.create({
      data: {
        unidadNegocioId,
        periodoMes,
        periodoAnio,
        ventas: valores.ventas!,
        costosDirectos: valores.costosDirectos!,
        gastosOperativos: valores.gastosOperativos!,
        expensas: valores.expensas!,
        otrasGananciasYPerdidas: valores.otrasGananciasYPerdidas!,
      },
    });
    creados++;
  }

  revalidatePath(`/empresa/${unidadNegocioId}/resultados-historicos`);
  return { creados, omitidosPorConflicto, omitidosPorDatosIncompletos };
}
