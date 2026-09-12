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

// Nombres de fila (columna B) tal como vienen en el archivo, mapeados a los
// campos del modelo. Las filas que no están acá (Margen de Contribución, %MC,
// Resultado Operativo, Resultado Neto) son valores derivados que el motor de
// informes calcula al vuelo — no se guardan.
const CAMPOS: Record<string, "ventas" | "costosDirectos" | "gastosOperativos" | "expensas" | "otrasGananciasYPerdidas"> = {
  Ventas: "ventas",
  "Costos directo de ventas": "costosDirectos",
  "Gastos Operativos": "gastosOperativos",
  Expensas: "expensas",
  "Otras Ganancias y perdidas": "otrasGananciasYPerdidas",
};

async function main() {
  const [filePath, empresaIdRaw, hastaPeriodoRaw] = process.argv.slice(2);
  if (!filePath || !empresaIdRaw) {
    throw new Error(
      'Uso: npx tsx prisma/import-resultados-historicos.ts "<ruta al xlsx>" <empresaId> [hastaAAAA-MM]'
    );
  }
  const empresaId = Number(empresaIdRaw);
  const hastaPeriodo = hastaPeriodoRaw ? new Date(`${hastaPeriodoRaw}-01T00:00:00Z`) : null;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");

  const filaPeriodos = sheet.getRow(2);
  const periodos = new Map<number, Date>(); // columna -> período
  for (let c = 3; c <= sheet.columnCount; c++) {
    const periodo = toDate(cellValue(filaPeriodos.getCell(c)));
    if (periodo) periodos.set(c, periodo);
  }

  const valoresPorPeriodo = new Map<number, Partial<Record<string, number>>>();
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const etiqueta = String(cellValue(row.getCell(2)) ?? "").trim();
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
      where: { empresaId_periodoMes_periodoAnio: { empresaId, periodoMes, periodoAnio } },
      update: {},
      create: {
        empresaId,
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

  console.log(`Listo: ${count} períodos de Resultados Históricos importados (empresa ${empresaId}).`);
  if (omitidos > 0) console.log(`${omitidos} período(s) omitido(s) por datos incompletos.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
