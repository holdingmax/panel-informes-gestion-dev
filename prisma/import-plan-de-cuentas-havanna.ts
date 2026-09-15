import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { CategoriaOrigenAplicacion, TipoPartida } from "../src/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const UNIDAD_NEGOCIO_ID = 3; // Havanna Argentina

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

// Havanna usa códigos cortos para algunas Partidas en la columna 17 (p. ej.
// "PN"); se traducen a los nombres canónicos ya existentes en la base
// (compartidos con Handyway Cargo / LV12) para no crear un duplicado como
// "PN" al lado de "PATRIMONIO NETO".
const PARTIDA_CANONICA: Record<string, string> = {
  ACTIVO: "ACTIVO",
  PASIVO: "PASIVO",
  PN: "PATRIMONIO NETO",
  INGRESOS: "INGRESOS",
  EGRESOS: "EGRESOS",
};

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

// El archivo de Havanna clasifica las cuentas de Resultado (INGRESOS/EGRESOS)
// con un Rubro genérico ("RESULTADO") y un Subrubro de detalle (columna
// SUBRUBRO); el bucket de 5 nombres que el motor de ER necesita como Rubro
// (Ventas/Costos directos/variables/Gastos Fijos Operativos/Expensas/Otras
// Ganancias y Perdidas) está directamente en la columna SUBRUBRO 2 — a
// diferencia de LV12, acá ya viene un nivel más a la izquierda. Se normalizan
// mayúsculas/acentos y se traduce al nombre EXACTO ya existente en la base.
const BUCKET_A_RUBRO: Record<string, string> = {
  VENTAS: "VENTAS",
  "COSTOS DIRECTOS/VARIABLES": "Costos directos/variables",
  "GASTOS FIJOS OPERATIVOS": "Gastos Fijos Operativos",
  EXPENSAS: "EXPENSAS",
  "OTRAS GANANCIAS Y PERDIDAS": "Otras Ganancias y Perdidas",
};

async function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error('Uso: npx tsx prisma/import-plan-de-cuentas-havanna.ts "<ruta al xlsx>"');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet("HOJA LLAVE");
  if (!sheet) throw new Error('No se encontró la hoja "HOJA LLAVE" en el archivo.');

  // La empresa placeholder (codEmp=3, "Havanna Argentina", vacía) se renombra
  // a la primera empresa real que trae el archivo ("PANINI"); "TUCSON" es una
  // segunda empresa real dentro de la misma Unidad de Negocio y se crea si
  // todavía no existe.
  const panini = await prisma.empresa.update({
    where: { codEmp: 3 },
    data: { nombreEmp: "PANINI" },
  });

  let tucson = await prisma.empresa.findFirst({
    where: { unidadNegocioId: UNIDAD_NEGOCIO_ID, nombreEmp: "TUCSON" },
  });
  if (!tucson) {
    tucson = await prisma.empresa.create({
      data: { nombreEmp: "TUCSON", unidadNegocioId: UNIDAD_NEGOCIO_ID },
    });
  }

  const empresaPorCodigo = new Map<string, number>([
    ["PANINI", panini.codEmp],
    ["TUCSON", tucson.codEmp],
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

  async function getPartida(nombreCanonico: string) {
    const cached = partidaCache.get(nombreCanonico);
    if (cached) return cached;
    const row = await prisma.partidaPatrimonial.create({
      data: { nomPartida: nombreCanonico, tipo: defaultTipoPartida(nombreCanonico) },
    });
    const entry = { id: row.codPartida, tipo: row.tipo };
    partidaCache.set(nombreCanonico, entry);
    return entry;
  }

  // Evita que un mismo nombre de Rubro (p. ej. "CORPORATE", "DEUDAS
  // COMERCIALES", "DEUDAS FINANCIERAS" — los tres aparecen en Havanna tanto en
  // cuentas de ACTIVO como de PASIVO) termine representando, con un solo id,
  // dos cosas distintas de cada lado del balance. Si aparece de nuevo con un
  // grupo distinto, se crea un Rubro nuevo con un sufijo aclaratorio.
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

    const partidaRaw = cellText(row.getCell(17));
    const rubroColumna = cellText(row.getCell(18));
    const subrubroColumna = cellText(row.getCell(19));
    const subrubro2Columna = cellText(row.getCell(20));

    if (!partidaRaw || !rubroColumna) {
      console.warn(`Fila ${r}: cuenta "${cuenta}" (${empresaCodigo}) sin Partida/Rubro, se omite.`);
      omitidas++;
      continue;
    }

    let partidaNombre = PARTIDA_CANONICA[partidaRaw.toUpperCase()] ?? partidaRaw;
    const esResultado = partidaNombre === "INGRESOS" || partidaNombre === "EGRESOS";

    // Caso especial verificado contra la hoja de referencia "Origen y Aplic
    // Fondos": el Rubro "CORPORATE" en Havanna son préstamos entre partes
    // relacionadas (LI SA, SPP SA, CREAR SA, Panini/Tucson, etc.) que la
    // propia planilla de origen consolida en UNA sola posición neta del lado
    // del Activo (615 -> 612.714.351,11), sumando lo prestado (cuentas de
    // Activo) y lo recibido (cuentas de Pasivo) del mismo grupo de
    // contrapartes — no las muestra como dos líneas separadas de Activo y
    // Pasivo. Sin este ajuste el Balance no cierra contra la referencia (el
    // total de Activo queda inflado y aparece un "CORPORATE" fantasma del
    // lado del Pasivo que la referencia no tiene). Se fuerza entonces la
    // Partida de estas cuentas de Pasivo a ACTIVO para que terminen en el
    // mismo Rubro/grupo que las de Activo.
    if (!esResultado && normalize(rubroColumna) === "CORPORATE" && partidaNombre === "PASIVO") {
      partidaNombre = "ACTIVO";
    }

    const grupo: TipoPartida | "OTRO" = defaultTipoPartida(partidaNombre) ?? "OTRO";

    let rubroNombre: string;
    let subrubroNombre: string;

    if (esResultado) {
      const bucketKey = normalize(subrubro2Columna);
      const rubroCanonico = BUCKET_A_RUBRO[bucketKey];
      if (!rubroCanonico) {
        console.warn(
          `Fila ${r}: cuenta "${cuenta}" (${empresaCodigo}) de Resultado sin clasificación de SUBRUBRO 2 válida ("${subrubro2Columna}"), se omite.`
        );
        omitidas++;
        continue;
      }
      rubroNombre = rubroCanonico;
      // Sin este detalle no hay cómo clasificar la cuenta en Ventas/Costos/
      // Gastos/Expensas/Otras G&P: usar el propio bucket como Subrubro es un
      // respaldo razonable, no se pierde información (ya no hay más nivel de
      // detalle disponible en el archivo para las cuentas de Resultado sin
      // SUBRUBRO propio).
      subrubroNombre = subrubroColumna || rubroCanonico;
    } else {
      rubroNombre = rubroColumna;
      // Havanna no trae SUBRUBRO para cuentas de Balance (Activo/Pasivo/PN);
      // se usa el propio nombre de Rubro como Subrubro — no hay mayor
      // granularidad disponible en el archivo fuente para estas cuentas.
      subrubroNombre = subrubroColumna || rubroColumna;
    }

    const partida = await getPartida(partidaNombre);
    const rubroId = await getRubro(rubroNombre, partidaNombre, grupo);
    const subrubroId = await getSubrubro(subrubroNombre);

    await prisma.planDeCuentas.upsert({
      where: { empresaId_cuenta: { empresaId, cuenta } },
      update: {
        partidaPatrimonialId: partida.id,
        rubroId,
        subrubroId,
        subrubro2Id: null,
      },
      create: {
        empresaId,
        cuenta,
        partidaPatrimonialId: partida.id,
        rubroId,
        subrubroId,
        subrubro2Id: null,
      },
    });
    count++;
  }

  console.log(`Listo: ${count} cuentas importadas (PANINI + TUCSON).`);
  if (omitidas > 0) console.log(`${omitidas} fila(s) omitida(s) — ver avisos arriba.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
