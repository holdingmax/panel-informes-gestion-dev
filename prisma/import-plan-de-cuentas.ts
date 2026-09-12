import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { CategoriaOrigenAplicacion, TipoPartida } from "../src/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return String(v.result);
    if ("richText" in v && v.richText) {
      return v.richText.map((t) => t.text).join("");
    }
  }
  return String(v).trim();
}

async function main() {
  const [filePath, empresaNombre] = process.argv.slice(2);
  if (!filePath || !empresaNombre) {
    throw new Error(
      'Uso: npx tsx prisma/import-plan-de-cuentas.ts "<ruta al xlsx>" "<Nombre Empresa>"'
    );
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet("HOJA LLAVE");
  if (!sheet) throw new Error('No se encontró la hoja "HOJA LLAVE" en el archivo.');

  const empresa =
    (await prisma.empresa.findFirst({ where: { nombreEmp: empresaNombre } })) ??
    (await prisma.empresa.create({ data: { nombreEmp: empresaNombre } }));

  const partidaCache = new Map<string, number>();
  const rubroCache = new Map<string, number>();
  const subrubroCache = new Map<string, number>();
  const subrubro2Cache = new Map<string, number>();
  const subrubro3Cache = new Map<string, number>();

  // Estos "default" son solo una conveniencia al importar por primera vez una
  // Partida/Rubro: el valor real que usa el motor de informes siempre se lee
  // de la tabla (editable en Configuración), nunca de esta función.
  function defaultTipoPartida(partidaNombre: string): TipoPartida | undefined {
    const p = partidaNombre.toUpperCase();
    if (p === "INGRESOS" || p === "EGRESOS") return "RESULTADO";
    if (p === "ACTIVO") return "ACTIVO";
    if (p === "PASIVO" || p === "REGULADORA DE PASIVO") return "PASIVO";
    if (p === "PATRIMONIO NETO") return "PATRIMONIO_NETO";
    return undefined;
  }

  function defaultCategoriaOyA(partidaNombre: string): CategoriaOrigenAplicacion | undefined {
    const p = partidaNombre.toUpperCase();
    if (p === "ACTIVO") return "APLICACION";
    if (p === "PASIVO" || p === "REGULADORA DE PASIVO" || p === "PATRIMONIO NETO") {
      return "ORIGEN";
    }
    return undefined; // INGRESOS/EGRESOS no participan del Origen y Aplicación de Fondos
  }

  async function getPartidaId(nombre: string) {
    if (partidaCache.has(nombre)) return partidaCache.get(nombre)!;
    const row = await prisma.partidaPatrimonial.upsert({
      where: { nomPartida: nombre },
      update: {},
      create: { nomPartida: nombre, tipo: defaultTipoPartida(nombre) },
    });
    partidaCache.set(nombre, row.codPartida);
    return row.codPartida;
  }

  async function getRubroId(nombre: string, partidaNombre: string) {
    if (rubroCache.has(nombre)) return rubroCache.get(nombre)!;
    const row = await prisma.rubro.upsert({
      where: { nomRubro: nombre },
      update: {},
      create: { nomRubro: nombre, categoriaOyA: defaultCategoriaOyA(partidaNombre) },
    });
    rubroCache.set(nombre, row.codRubro);
    return row.codRubro;
  }

  async function getSubrubroId(nombre: string) {
    if (subrubroCache.has(nombre)) return subrubroCache.get(nombre)!;
    const row = await prisma.subrubro.upsert({
      where: { nomSubrubro: nombre },
      update: {},
      create: { nomSubrubro: nombre },
    });
    subrubroCache.set(nombre, row.codSubrubro);
    return row.codSubrubro;
  }

  async function getSubrubro2Id(nombre: string) {
    if (subrubro2Cache.has(nombre)) return subrubro2Cache.get(nombre)!;
    const row = await prisma.subrubro2.upsert({
      where: { nomSubrubro2: nombre },
      update: {},
      create: { nomSubrubro2: nombre },
    });
    subrubro2Cache.set(nombre, row.codSubrubro2);
    return row.codSubrubro2;
  }

  async function getSubrubro3Id(nombre: string) {
    if (subrubro3Cache.has(nombre)) return subrubro3Cache.get(nombre)!;
    const row = await prisma.subrubro3.upsert({
      where: { nomSubrubro3: nombre },
      update: {},
      create: { nomSubrubro3: nombre },
    });
    subrubro3Cache.set(nombre, row.codSubrubro3);
    return row.codSubrubro3;
  }

  const rubroPartidaSeen = new Map<string, string>();

  let count = 0;
  for (let r = 11; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cuenta = cellText(row.getCell(2));
    if (!cuenta) continue;

    const partidaNombre = cellText(row.getCell(10));
    const rubroNombre = cellText(row.getCell(11));
    const subrubroNombre = cellText(row.getCell(12));
    const nivel2Nombre = cellText(row.getCell(13));
    const nivel3Nombre = cellText(row.getCell(14));

    if (!partidaNombre || !rubroNombre || !subrubroNombre) {
      console.warn(`Fila ${r}: cuenta "${cuenta}" sin Partida/Rubro/Subrubro, se omite.`);
      continue;
    }

    if (!rubroPartidaSeen.has(rubroNombre)) rubroPartidaSeen.set(rubroNombre, partidaNombre);

    const [partidaPatrimonialId, rubroId, subrubroId, subrubro2Id, subrubro3Id] =
      await Promise.all([
        getPartidaId(partidaNombre),
        getRubroId(rubroNombre, partidaNombre),
        getSubrubroId(subrubroNombre),
        nivel2Nombre ? getSubrubro2Id(nivel2Nombre) : Promise.resolve(null),
        nivel3Nombre ? getSubrubro3Id(nivel3Nombre) : Promise.resolve(null),
      ]);

    await prisma.planDeCuentas.upsert({
      where: { empresaId_cuenta: { empresaId: empresa.codEmp, cuenta } },
      update: { partidaPatrimonialId, rubroId, subrubroId, subrubro2Id, subrubro3Id },
      create: {
        empresaId: empresa.codEmp,
        cuenta,
        partidaPatrimonialId,
        rubroId,
        subrubroId,
        subrubro2Id,
        subrubro3Id,
      },
    });
    count++;
  }

  let rubrosBackfilled = 0;
  for (const [rubroNombre, partidaNombre] of rubroPartidaSeen) {
    const rubroId = rubroCache.get(rubroNombre)!;
    const actual = await prisma.rubro.findUnique({ where: { codRubro: rubroId } });
    if (actual && actual.categoriaOyA === null) {
      const categoriaOyA = defaultCategoriaOyA(partidaNombre);
      if (categoriaOyA) {
        await prisma.rubro.update({ where: { codRubro: rubroId }, data: { categoriaOyA } });
        rubrosBackfilled++;
      }
    }
  }

  let partidasBackfilled = 0;
  for (const [partidaNombre, partidaId] of partidaCache) {
    const actual = await prisma.partidaPatrimonial.findUnique({ where: { codPartida: partidaId } });
    if (actual && actual.tipo === null) {
      const tipo = defaultTipoPartida(partidaNombre);
      if (tipo) {
        await prisma.partidaPatrimonial.update({ where: { codPartida: partidaId }, data: { tipo } });
        partidasBackfilled++;
      }
    }
  }

  console.log(`Listo: ${count} cuentas del Plan de Cuentas de "${empresaNombre}" importadas.`);
  if (rubrosBackfilled > 0) {
    console.log(`Se clasificó Origen/Aplicación por defecto en ${rubrosBackfilled} rubro(s) existentes.`);
  }
  if (partidasBackfilled > 0) {
    console.log(`Se clasificó Tipo (Balance/Resultado) por defecto en ${partidasBackfilled} partida(s) existentes.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
