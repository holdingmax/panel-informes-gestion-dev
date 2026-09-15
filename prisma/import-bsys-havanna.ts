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

// Debe-Haber neto -> par (Debe, Haber) preservando la convención habitual
// (un solo lado no-cero) para no alterar el neto que de verdad usan
// balance-oya-report.ts y resultado-nominal.ts (siempre Debe-Haber).
function splitNet(net: number): { debe: number; haber: number } {
  return net >= 0 ? { debe: net, haber: 0 } : { debe: 0, haber: -net };
}

function leerHoja(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  tipo: "MES" | "ACUMULADO",
  fechaCarga: Date,
  empresaPorCodigo: Map<string, number>,
  // La hoja "HOJA LLAVE" (Acumulado) trae columnas de reclasificación
  // (Reclasif SI / Reclasif SF, típicamente cheques diferidos o sobregiros
  // bancarios reclasificados de Disponibilidades a Deudas Financieras) que
  // hay que sumar al saldo crudo para llegar al saldo de presentación real —
  // confirmado comparando contra la hoja de referencia "Origen y Aplic
  // Fondos" (cuenta "BANCO GALICIA..." / "CHEQUE DIFERIDO"). La hoja "SYS
  // 06-2026" (Mes) no trae esta reclasificación (todas sus columnas AJUSTES
  // están en 0), así que para esa no se pasa este parámetro.
  reclasifCols?: { inicio: number; final: number }
): FilaBSyS[] {
  const filas: FilaBSyS[] = [];
  for (let r = startRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const empresaCodigo = cellText(row.getCell(1));
    const cuenta = cellText(row.getCell(2));
    if (!empresaCodigo || !cuenta) continue;

    const empresaId = empresaPorCodigo.get(empresaCodigo);
    if (!empresaId) continue; // fila de totales u otra cosa

    const reclasifIni = reclasifCols ? cellNumber(row.getCell(reclasifCols.inicio)) : 0;
    const reclasifFinal = reclasifCols ? cellNumber(row.getCell(reclasifCols.final)) : 0;

    // Verificado contra las fórmulas reales de "HOJA LLAVE" (columnas J-N):
    // el Saldo Final "de presentación" arrastra la reclasificación de
    // Saldo Inicio (Reclasif SI) además de sumar su propia Reclasif SF — no
    // alcanza con sumar solo esta última al saldo final crudo.
    const netIni = cellNumber(row.getCell(3)) - cellNumber(row.getCell(4)) + reclasifIni;
    const netFinal = cellNumber(row.getCell(7)) - cellNumber(row.getCell(8)) + reclasifIni + reclasifFinal;
    const ini = splitNet(netIni);
    const fin = splitNet(netFinal);

    filas.push({
      empresaId,
      tipo,
      fechaCarga,
      cuenta,
      saldoIniDebe: ini.debe,
      saldoIniHaber: ini.haber,
      sumasDebe: cellNumber(row.getCell(5)),
      sumasHaber: cellNumber(row.getCell(6)),
      saldoCierreDebe: fin.debe,
      saldoCierreHaber: fin.haber,
    });
  }
  return filas;
}

async function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error('Uso: npx tsx prisma/import-bsys-havanna.ts "<ruta al xlsx>"');
  }

  const periodoMes = 6;
  const periodoAnio = 2026;
  const unidadNegocioId = 3; // Havanna Argentina

  const empresas = await prisma.empresa.findMany({ where: { unidadNegocioId } });
  const empresaPorCodigo = new Map<string, number>(empresas.map((e) => [e.nombreEmp, e.codEmp]));
  if (!empresaPorCodigo.has("PANINI") || !empresaPorCodigo.has("TUCSON")) {
    throw new Error(
      'No se encontraron las empresas "PANINI"/"TUCSON" en la Unidad de Negocio Havanna Argentina — corré primero prisma/import-plan-de-cuentas-havanna.ts.'
    );
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  // El Acumulado (ejercicio jul-jun a la fecha) viene en "HOJA LLAVE"
  // (columnas 3-8, igual estructura que LV12). El Mes (junio 2026 solo) no
  // está en una hoja "HOJA LLAVE MES" separada como en LV12 — en Havanna esa
  // apertura mensual viene en la hoja "SYS 06-2026", con exactamente la misma
  // disposición de columnas 3-8 (Saldo Inicio Debe/Haber, Sumas Debe/Haber,
  // Saldo Final Deudor/Acreedor), solo que arranca en la fila 2 (no 6).
  const hojaAcumulado = wb.getWorksheet("HOJA LLAVE");
  const hojaMes = wb.getWorksheet("SYS 06-2026");
  if (!hojaAcumulado) throw new Error('No se encontró la hoja "HOJA LLAVE".');
  if (!hojaMes) throw new Error('No se encontró la hoja "SYS 06-2026".');

  const fechaCarga = new Date();

  const filasAcumulado = leerHoja(hojaAcumulado, 6, "ACUMULADO", fechaCarga, empresaPorCodigo, {
    inicio: 9,
    final: 13,
  });
  const filasMes = leerHoja(hojaMes, 2, "MES", fechaCarga, empresaPorCodigo);

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

  console.log(`Listo: BSyS de ${periodoMes}/${periodoAnio} importado para Havanna Argentina (PANINI + TUCSON).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
