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

async function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error('Uso: npx tsx prisma/import-series-e-indices.ts "<ruta al xlsx>"');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");

  let count = 0;
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const periodo = toDate(cellValue(row.getCell(1)));
    const indice = cellValue(row.getCell(2));
    const dolar = cellValue(row.getCell(3));
    if (!periodo || indice === null || indice === undefined || dolar === null || dolar === undefined) {
      continue;
    }

    await prisma.seriesEIndices.upsert({
      where: { periodo },
      update: { indice: Number(indice), dolar: Number(dolar) },
      create: { periodo, indice: Number(indice), dolar: Number(dolar) },
    });
    count++;
  }

  console.log(`Listo: ${count} períodos de Series e Índices importados.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
