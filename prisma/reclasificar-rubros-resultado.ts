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

function normalizeCuenta(cuenta: string): string {
  return cuenta.trim().replace(/\s+/g, " ").toUpperCase();
}

// Reclasifica el Rubro únicamente de las cuentas de Resultado (Ingresos y
// Egresos): el Balance y el Origen y Aplicación de Fondos usan la
// clasificación existente de Activo/Pasivo/Patrimonio Neto, que esto no toca.
async function main() {
  const [filePath, empresaNombre] = process.argv.slice(2);
  if (!filePath || !empresaNombre) {
    throw new Error(
      'Uso: npx tsx prisma/reclasificar-rubros-resultado.ts "<ruta al xlsx>" "<Nombre Empresa>"'
    );
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet("HOJA LLAVE");
  if (!sheet) throw new Error('No se encontró la hoja "HOJA LLAVE" en el archivo.');

  const empresa = await prisma.empresa.findFirstOrThrow({ where: { nombreEmp: empresaNombre } });

  const rubroCache = new Map<string, number>();
  async function getRubroId(nombre: string) {
    if (rubroCache.has(nombre)) return rubroCache.get(nombre)!;
    const row = await prisma.rubro.upsert({
      where: { nomRubro: nombre },
      update: {},
      create: { nomRubro: nombre },
    });
    rubroCache.set(nombre, row.codRubro);
    return row.codRubro;
  }

  const planesEmpresa = await prisma.planDeCuentas.findMany({
    where: { empresaId: empresa.codEmp },
    include: { partidaPatrimonial: true },
  });
  const porCuenta = new Map(planesEmpresa.map((p) => [normalizeCuenta(p.cuenta), p]));

  let actualizadas = 0;
  let sinCambio = 0;
  const noEncontradas: string[] = [];

  for (let r = 11; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cuenta = cellText(row.getCell(2));
    if (!cuenta) continue;

    const partidaNombre = cellText(row.getCell(10)).toUpperCase();
    if (partidaNombre !== "INGRESOS" && partidaNombre !== "EGRESOS") continue;

    const rubroNombre = cellText(row.getCell(11));
    if (!rubroNombre) continue;

    const plan = porCuenta.get(normalizeCuenta(cuenta));
    if (!plan) {
      noEncontradas.push(cuenta);
      continue;
    }
    if (plan.partidaPatrimonial.tipo !== "RESULTADO") {
      // La cuenta existe pero en el Plan de Cuentas actual no está clasificada
      // como Resultado — no se toca para no mezclar con Balance por error.
      continue;
    }

    const rubroId = await getRubroId(rubroNombre);
    if (rubroId === plan.rubroId) {
      sinCambio++;
      continue;
    }
    await prisma.planDeCuentas.update({ where: { id: plan.id }, data: { rubroId } });
    actualizadas++;
  }

  console.log(`Listo: ${actualizadas} cuenta(s) reclasificadas, ${sinCambio} ya estaban correctas.`);
  if (noEncontradas.length > 0) {
    console.warn(
      `${noEncontradas.length} cuenta(s) de Resultado en HOJA LLAVE no existen en el Plan de Cuentas actual (se omitieron):`
    );
    console.warn(noEncontradas.slice(0, 20));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
