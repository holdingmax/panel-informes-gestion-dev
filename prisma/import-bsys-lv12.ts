import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return String(v.result);
    if ("richText" in v && v.richText) return v.richText.map((t) => t.text).join("");
  }
  return String(v).trim();
}

function cellNumber(cell: ExcelJS.Cell): number {
  const v = cell.value;
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "result" in v && typeof v.result === "number") return v.result;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const EMPRESA_POR_CODIGO = new Map<string, number>([
  ["LV12", 4],
  ["Info", 5],
]);

type FilaBSyS = {
  empresaId: number;
  tipo: "MES" | "ACUMULADO";
  fechaCarga: Date;
  cuenta: string;
  saldoIniDebe: number;
  saldoIniHaber: number;
  sumasDebe: number;
  sumasHaber: number;
  saldoCierreDebe: number;
  saldoCierreHaber: number;
};

function leerHoja(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  tipo: "MES" | "ACUMULADO",
  fechaCarga: Date
): FilaBSyS[] {
  const filas: FilaBSyS[] = [];
  for (let r = startRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const empresaCodigo = cellText(row.getCell(1));
    const cuenta = cellText(row.getCell(2));
    if (!empresaCodigo || !cuenta) continue;

    const empresaId = EMPRESA_POR_CODIGO.get(empresaCodigo);
    if (!empresaId) continue; // fila de totales u otra cosa

    filas.push({
      empresaId,
      tipo,
      fechaCarga,
      cuenta,
      saldoIniDebe: cellNumber(row.getCell(3)),
      saldoIniHaber: cellNumber(row.getCell(4)),
      sumasDebe: cellNumber(row.getCell(5)),
      sumasHaber: cellNumber(row.getCell(6)),
      saldoCierreDebe: cellNumber(row.getCell(7)),
      saldoCierreHaber: cellNumber(row.getCell(8)),
    });
  }
  return filas;
}

async function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error('Uso: npx tsx prisma/import-bsys-lv12.ts "<ruta al xlsx>"');
  }

  const periodoMes = 6;
  const periodoAnio = 2026;
  const unidadNegocioId = 4; // Grupo LV12

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const hojaAcumulado = wb.getWorksheet("HOJA LLAVE");
  const hojaMes = wb.getWorksheet("HOJA LLAVE MES");
  if (!hojaAcumulado) throw new Error('No se encontró la hoja "HOJA LLAVE".');
  if (!hojaMes) throw new Error('No se encontró la hoja "HOJA LLAVE MES".');

  const fechaCarga = new Date();

  const filasAcumulado = leerHoja(hojaAcumulado, 6, "ACUMULADO", fechaCarga);
  const filasMes = leerHoja(hojaMes, 7, "MES", fechaCarga);

  console.log(`Acumulado: ${filasAcumulado.length} filas. Mes: ${filasMes.length} filas.`);

  await prisma.$transaction(async (tx) => {
    await tx.balanceSumasYSaldos.createMany({ data: filasAcumulado });
    await tx.balanceSumasYSaldos.createMany({ data: filasMes });
    await tx.informe.upsert({
      where: { unidadNegocioId_periodoMes_periodoAnio: { unidadNegocioId, periodoMes, periodoAnio } },
      update: {},
      create: { unidadNegocioId, periodoMes, periodoAnio },
    });
  });

  console.log(`Listo: BSyS de ${periodoMes}/${periodoAnio} importado para Grupo LV12 (LV12 + Info).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
