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

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function defaultTipoPartida(partidaNombre: string): TipoPartida | undefined {
  const p = partidaNombre.toUpperCase();
  if (p === "INGRESOS" || p === "EGRESOS") return "RESULTADO";
  if (p === "ACTIVO") return "ACTIVO";
  if (p === "PASIVO" || p === "REGULADORA DE PASIVO") return "PASIVO";
  if (p === "PATRIMONIO NETO") return "PATRIMONIO_NETO";
  return undefined; // "CUENTA DE ORDEN" y similares quedan sin clasificar a propósito
}

function defaultCategoriaOyA(partidaNombre: string): CategoriaOrigenAplicacion | undefined {
  const p = partidaNombre.toUpperCase();
  if (p === "ACTIVO") return "APLICACION";
  if (p === "PASIVO" || p === "REGULADORA DE PASIVO" || p === "PATRIMONIO NETO") return "ORIGEN";
  return undefined;
}

// El archivo de LV12 organiza las cuentas de Resultado (INGRESOS/EGRESOS) con
// un Rubro genérico ("Resultado") y dos niveles más finos (Subrubro y "Para
// rdo"); el bucket de 5 columnas que el motor de informes necesita como
// Rubro (Ventas/Costos directos/variables/Gastos Fijos Operativos/Expensas/
// Otras Ganancias y Perdidas) está en la columna "Para presentacion
// directorio" — hay que reusar exactamente los nombres ya existentes en la
// base (compartidos con Handyway Cargo) para que el motor de ER siga
// reconociéndolos.
const PRESENTACION_A_RUBRO: Record<string, string> = {
  VENTAS: "VENTAS",
  "COSTOS DIRECTOS/VARIABLES": "Costos directos/variables",
  "COSTOS FIJOS": "Gastos Fijos Operativos",
  EXPENSAS: "EXPENSAS",
  "OTRAS GANANCIAS Y PERDIDAS": "Otras Ganancias y Perdidas",
};

async function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error('Uso: npx tsx prisma/import-plan-de-cuentas-lv12.ts "<ruta al xlsx>"');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet("HOJA LLAVE");
  if (!sheet) throw new Error('No se encontró la hoja "HOJA LLAVE" en el archivo.');

  const empresaPorCodigo = new Map<string, number>([
    ["LV12", 4],
    ["Info", 5],
  ]);

  const partidaCache = new Map<string, { id: number; tipo: TipoPartida | null }>();
  for (const p of await prisma.partidaPatrimonial.findMany()) {
    partidaCache.set(p.nomPartida, { id: p.codPartida, tipo: p.tipo });
  }

  const rubroCache = new Map<string, number>(); // normalizado -> id (para reuso)
  const rubroGrupoAsignado = new Map<string, TipoPartida | "OTRO">(); // nombre exacto usado -> grupo, detectado durante esta importación
  for (const r of await prisma.rubro.findMany()) {
    rubroCache.set(normalize(r.nomRubro), r.codRubro);
  }

  const subrubroCache = new Map<string, number>();
  for (const s of await prisma.subrubro.findMany()) subrubroCache.set(normalize(s.nomSubrubro), s.codSubrubro);
  const subrubro2Cache = new Map<string, number>();
  for (const s of await prisma.subrubro2.findMany()) subrubro2Cache.set(normalize(s.nomSubrubro2), s.codSubrubro2);

  async function getPartida(nombre: string) {
    const cached = partidaCache.get(nombre);
    if (cached) return cached;
    const row = await prisma.partidaPatrimonial.create({
      data: { nomPartida: nombre, tipo: defaultTipoPartida(nombre) },
    });
    const entry = { id: row.codPartida, tipo: row.tipo };
    partidaCache.set(nombre, entry);
    return entry;
  }

  // Evita que un mismo nombre de Rubro (p. ej. "CORPORATE") termine
  // representando, con un solo id, tanto un préstamo otorgado (Activo) como
  // uno recibido (Pasivo) — o que una fila de "CUENTA DE ORDEN" (ajuste,
  // fuera del balance) se mezcle con el Rubro real del balance que comparte
  // su mismo nombre. En cualquiera de esos casos se crea un Rubro nuevo con
  // un sufijo que lo distingue.
  async function getRubro(nombreOriginal: string, partidaNombre: string, grupo: TipoPartida | "OTRO") {
    let nombre = nombreOriginal;
    const grupoPrevio = rubroGrupoAsignado.get(normalize(nombre));
    if (grupoPrevio !== undefined && grupoPrevio !== grupo) {
      const sufijo = grupo === "OTRO" ? "Cuenta de Orden" : grupo;
      nombre = `${nombreOriginal} (${sufijo})`;
    }
    rubroGrupoAsignado.set(normalize(nombre), grupo);

    const key = normalize(nombre);
    const cachedId = rubroCache.get(key);
    if (cachedId) return cachedId;

    const row = await prisma.rubro.create({
      data: { nomRubro: nombre, categoriaOyA: defaultCategoriaOyA(partidaNombre) },
    });
    rubroCache.set(key, row.codRubro);
    return row.codRubro;
  }

  async function getSubrubro(nombre: string) {
    const key = normalize(nombre);
    const cachedId = subrubroCache.get(key);
    if (cachedId) return cachedId;
    const row = await prisma.subrubro.create({ data: { nomSubrubro: nombre } });
    subrubroCache.set(key, row.codSubrubro);
    return row.codSubrubro;
  }

  async function getSubrubro2(nombre: string) {
    const key = normalize(nombre);
    const cachedId = subrubro2Cache.get(key);
    if (cachedId) return cachedId;
    const row = await prisma.subrubro2.create({ data: { nomSubrubro2: nombre } });
    subrubro2Cache.set(key, row.codSubrubro2);
    return row.codSubrubro2;
  }

  let count = 0;
  let omitidas = 0;

  for (let r = 6; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const empresaCodigo = cellText(row.getCell(1));
    const cuenta = cellText(row.getCell(2));
    if (!empresaCodigo || !cuenta) continue;

    const empresaId = empresaPorCodigo.get(empresaCodigo);
    if (!empresaId) {
      console.warn(`Fila ${r}: código de empresa "${empresaCodigo}" no reconocido, se omite.`);
      omitidas++;
      continue;
    }

    const partidaNombre = cellText(row.getCell(16));
    const rubroColumna = cellText(row.getCell(17));
    const subrubroColumna = cellText(row.getCell(18));
    const paraRdoColumna = cellText(row.getCell(19));
    const presentacionColumna = cellText(row.getCell(20));

    if (!partidaNombre || !rubroColumna || !subrubroColumna) {
      console.warn(`Fila ${r}: cuenta "${cuenta}" (${empresaCodigo}) sin Partida/Rubro/Subrubro, se omite.`);
      omitidas++;
      continue;
    }

    const esResultado = partidaNombre === "INGRESOS" || partidaNombre === "EGRESOS";
    const grupo: TipoPartida | "OTRO" =
      partidaNombre === "CUENTA DE ORDEN" ? "OTRO" : (defaultTipoPartida(partidaNombre) ?? "OTRO");

    let rubroNombre: string;
    let subrubroNombre: string;
    let subrubro2Nombre: string | null;

    if (esResultado) {
      const presentacionKey = normalize(presentacionColumna);
      const rubroCanonico = PRESENTACION_A_RUBRO[presentacionKey];
      if (!rubroCanonico) {
        console.warn(
          `Fila ${r}: cuenta "${cuenta}" (${empresaCodigo}) de Resultado sin clasificación de presentación válida ("${presentacionColumna}"), se omite.`
        );
        omitidas++;
        continue;
      }
      rubroNombre = rubroCanonico;
      subrubroNombre = subrubroColumna;
      subrubro2Nombre = paraRdoColumna && paraRdoColumna !== "0" ? paraRdoColumna : null;
    } else {
      rubroNombre = rubroColumna;
      subrubroNombre = subrubroColumna;
      subrubro2Nombre = null;
    }

    const partida = await getPartida(partidaNombre);
    const rubroId = await getRubro(rubroNombre, partidaNombre, grupo);
    const subrubroId = await getSubrubro(subrubroNombre);
    const subrubro2Id = subrubro2Nombre ? await getSubrubro2(subrubro2Nombre) : null;

    await prisma.planDeCuentas.upsert({
      where: { empresaId_cuenta: { empresaId, cuenta } },
      update: {
        partidaPatrimonialId: partida.id,
        rubroId,
        subrubroId,
        subrubro2Id,
      },
      create: {
        empresaId,
        cuenta,
        partidaPatrimonialId: partida.id,
        rubroId,
        subrubroId,
        subrubro2Id,
      },
    });
    count++;
  }

  console.log(`Listo: ${count} cuentas importadas (LV12 + Info).`);
  if (omitidas > 0) console.log(`${omitidas} fila(s) omitida(s) — ver avisos arriba.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
