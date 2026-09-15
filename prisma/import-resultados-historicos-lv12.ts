import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v !== null && typeof v === "object" && "result" in v) return v.result;
  return v;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  return null;
}

// Mismo diccionario que prisma/import-resultados-historicos.ts: las filas que
// no están acá (Margen de Contribucion, %MC, Resultado Operativo, Resultado
// Neto) son valores derivados que el motor de informes calcula al vuelo.
const CAMPOS: Record<string, "ventas" | "costosDirectos" | "gastosOperativos" | "expensas" | "otrasGananciasYPerdidas"> = {
  Ventas: "ventas",
  "Costos directo de ventas": "costosDirectos",
  "Costos Fijos": "gastosOperativos",
  Expensas: "expensas",
  "Otras Ganancias y perdidas": "otrasGananciasYPerdidas",
};

async function main() {
  const [filePath, hastaPeriodoRaw] = process.argv.slice(2);
  if (!filePath) {
    throw new Error(
      'Uso: npx tsx prisma/import-resultados-historicos-lv12.ts "<ruta al xlsx>" [hastaAAAA-MM]'
    );
  }
  const unidadNegocioId = 4; // Grupo LV12
  const hastaPeriodo = hastaPeriodoRaw ? new Date(`${hastaPeriodoRaw}-01T00:00:00Z`) : null;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");

  // A diferencia de prisma/import-resultados-historicos.ts (que tiene una
  // columna/fila de margen extra), este archivo de LV12 arranca directo: fila
  // 1 = períodos (desde columna 2), columna 1 = etiqueta de cada fila.
  const filaPeriodos = sheet.getRow(1);
  const periodos = new Map<number, Date>();
  for (let c = 2; c <= sheet.columnCount; c++) {
    const periodo = toDate(cellValue(filaPeriodos.getCell(c)));
    if (periodo) periodos.set(c, periodo);
  }

  const valoresPorPeriodo = new Map<number, Partial<Record<string, number>>>();
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const etiqueta = String(cellValue(row.getCell(1)) ?? "").trim();
    const campo = CAMPOS[etiqueta];
    if (!campo) continue;

    for (const [c, periodo] of periodos) {
      const valor = cellValue(row.getCell(c));
      if (valor === null || valor === undefined || valor === "") continue;
      const key = periodo.getTime();
      if (!valoresPorPeriodo.has(key)) valoresPorPeriodo.set(key, {});
      valoresPorPeriodo.get(key)![campo] = Number(valor);
    }
  }

  let count = 0;
  let omitidos = 0;
  for (const [key, valores] of valoresPorPeriodo) {
    const periodo = new Date(key);
    if (hastaPeriodo && periodo > hastaPeriodo) continue;

    const completo =
      valores.ventas !== undefined &&
      valores.costosDirectos !== undefined &&
      valores.gastosOperativos !== undefined &&
      valores.expensas !== undefined &&
      valores.otrasGananciasYPerdidas !== undefined;
    if (!completo) {
      console.warn(
        `Aviso: período ${periodo.toISOString().slice(0, 7)} tiene campos faltantes, se omite.`
      );
      omitidos++;
      continue;
    }

    const periodoMes = periodo.getUTCMonth() + 1;
    const periodoAnio = periodo.getUTCFullYear();

    await prisma.resultadosHistoricos.upsert({
      where: { unidadNegocioId_periodoMes_periodoAnio: { unidadNegocioId, periodoMes, periodoAnio } },
      update: {},
      create: {
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
    count++;
  }

  console.log(`Listo: ${count} períodos de Resultados Históricos importados (Grupo LV12).`);
  if (omitidos > 0) console.log(`${omitidos} período(s) omitido(s) por datos incompletos.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
