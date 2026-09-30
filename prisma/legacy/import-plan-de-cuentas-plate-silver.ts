import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { CategoriaOrigenAplicacion, RolTipoPartida } from "../../src/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EMPRESA_ID = 7; // Plate Silver (unidadNegocioId: 6) — único empresa en este archivo

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

function defaultRolPartida(partidaNombre: string): RolTipoPartida | undefined {
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

// A diferencia de LV12 (bucket en columna "Para presentacion directorio") y
// Havanna (bucket en columna "SUBRUBRO 2"), el archivo de Plate Silver trae
// el bucket de 5 nombres que el motor de ER necesita (Ventas/Costos
// directos-variables/Gastos Fijos Operativos/Expensas/Otras Ganancias y
// Perdidas) directamente en la propia columna RUBRO para las cuentas de
// Resultado (INGRESOS/EGRESOS) — no hay una columna extra más a la derecha.
// El detalle real de cada cuenta (lo que en LV12/Havanna sería más
// información) queda en la columna SUBRUBRO, que se preserva tal cual. Se
// traduce el texto de RUBRO al nombre EXACTO ya existente en la base
// (compartido con Handyway Cargo/LV12/Havanna/Bradenton) usando comparación
// normalizada (mayúsculas/acentos/espacios), ya que la planilla usa una
// redacción levemente distinta ("Costos directo de venta" en vez de "Costos
// directos/variables", etc.).
const BUCKET_A_RUBRO: Record<string, string> = {
  VENTAS: "VENTAS",
  "COSTOS DIRECTO DE VENTA": "Costos directos/variables",
  "COSTOS DIRECTOS/VARIABLES": "Costos directos/variables",
  "GASTOS FIJOS OPERATIVOS": "Gastos Fijos Operativos",
  EXPENSAS: "EXPENSAS",
  "OTRAS GANANCIAS Y PERDIDAS": "Otras Ganancias y Perdidas",
};

async function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error('Uso: npx tsx prisma/import-plan-de-cuentas-plate-silver.ts "<ruta al xlsx>"');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet("HOJA LLAVE");
  if (!sheet) throw new Error('No se encontró la hoja "HOJA LLAVE" en el archivo.');

  const partidaCache = new Map<string, { id: number; rol: RolTipoPartida | null }>();
  for (const p of await prisma.partidaPatrimonial.findMany({ include: { tipo: true } })) {
    partidaCache.set(p.nomPartida, { id: p.codPartida, rol: p.tipo?.rol ?? null });
  }

  const tipoIdPorRolCache = new Map<RolTipoPartida, number>();
  const NOMBRE_TIPO_POR_ROL: Record<RolTipoPartida, string> = {
    ACTIVO: "Activo",
    PASIVO: "Pasivo",
    PATRIMONIO_NETO: "Patrimonio Neto",
    RESULTADO: "Resultado",
  };
  async function getTipoIdPorRol(rol: RolTipoPartida): Promise<number> {
    if (tipoIdPorRolCache.has(rol)) return tipoIdPorRolCache.get(rol)!;
    const row =
      (await prisma.tipoPartida.findFirst({ where: { rol } })) ??
      (await prisma.tipoPartida.create({ data: { nomTipo: NOMBRE_TIPO_POR_ROL[rol], rol } }));
    tipoIdPorRolCache.set(rol, row.codTipo);
    return row.codTipo;
  }

  const rubroCache = new Map<string, number>(); // normalizado -> id (para reuso)
  const rubroGrupoAsignado = new Map<string, RolTipoPartida | "OTRO">(); // nombre exacto usado -> grupo
  for (const r of await prisma.rubro.findMany()) {
    rubroCache.set(normalize(r.nomRubro), r.codRubro);
  }

  // A diferencia de LV12/Havanna (donde el catálogo de Rubro partía casi
  // vacío y el guard sólo necesitaba detectar colisiones dentro del propio
  // archivo), acá el catálogo ya trae Rubros de Handyway Cargo, Conexión
  // Logística, Havanna, LV12 y Bradenton. Para que el guard también detecte
  // una colisión CONTRA ese historial (no sólo dentro del archivo de Plate
  // Silver) se precarga rubroGrupoAsignado con el grupo real de cada Rubro
  // ya existente, inferido de las cuentas que efectivamente lo usan hoy
  // (vía PartidaPatrimonial.tipo.rol). Si un Rubro ya existente se usa con
  // más de un rol distinto (dato previo ambiguo, ajeno a esta importación)
  // se deja sin precargar — no es responsabilidad de esta importación
  // corregir esa ambigüedad previa.
  {
    const rubrosConUso = await prisma.rubro.findMany({
      include: {
        planes: {
          distinct: ["partidaPatrimonialId"],
          include: { partidaPatrimonial: { include: { tipo: true } } },
        },
      },
    });
    for (const r of rubrosConUso) {
      const roles = new Set<RolTipoPartida | "OTRO">();
      for (const plan of r.planes) {
        const rol = plan.partidaPatrimonial.tipo?.rol;
        roles.add(rol ?? "OTRO");
      }
      if (roles.size === 1) {
        rubroGrupoAsignado.set(normalize(r.nomRubro), Array.from(roles)[0]);
      }
    }
  }

  const subrubroCache = new Map<string, number>();
  for (const s of await prisma.subrubro.findMany()) subrubroCache.set(normalize(s.nomSubrubro), s.codSubrubro);
  const subrubro2Cache = new Map<string, number>();
  for (const s of await prisma.subrubro2.findMany()) subrubro2Cache.set(normalize(s.nomSubrubro2), s.codSubrubro2);

  let partidaCreadas = 0;
  let rubroCreados = 0;
  let subrubroCreados = 0;

  async function getPartida(nombre: string) {
    const cached = partidaCache.get(nombre);
    if (cached) return cached;
    const rol = defaultRolPartida(nombre);
    const tipoId = rol ? await getTipoIdPorRol(rol) : null;
    const row = await prisma.partidaPatrimonial.create({
      data: { nomPartida: nombre, tipoId },
    });
    const entry = { id: row.codPartida, rol: rol ?? null };
    partidaCache.set(nombre, entry);
    partidaCreadas++;
    return entry;
  }

  // Evita que un mismo nombre de Rubro (p. ej. "CORPORATE", que en
  // LV12/Info/PANINI/TUCSON son préstamos OTORGADOS del lado del Activo)
  // termine representando con un solo id algo distinto en Plate Silver,
  // donde "CORPORATE" es una deuda con partes relacionadas del lado del
  // Pasivo (fila "DEUDA SOCIO ... / CORPORATE", grupo PASIVO). Al detectar
  // el grupo previo (ACTIVO, precargado desde el historial real) distinto
  // del grupo actual (PASIVO), se agrega el sufijo "(PASIVO)" — lo que
  // reutiliza el Rubro "CORPORATE (PASIVO)" que ya existe en la base
  // (creado para el mismo propósito por la importación de LV12/Bradenton)
  // en vez de crear un duplicado o mezclarlo con el "CORPORATE" de Activo.
  async function getRubro(nombreOriginal: string, partidaNombre: string, grupo: RolTipoPartida | "OTRO") {
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
    rubroCreados++;
    return row.codRubro;
  }

  async function getSubrubro(nombre: string) {
    const key = normalize(nombre);
    const cachedId = subrubroCache.get(key);
    if (cachedId) return cachedId;
    const row = await prisma.subrubro.create({ data: { nomSubrubro: nombre } });
    subrubroCache.set(key, row.codSubrubro);
    subrubroCreados++;
    return row.codSubrubro;
  }

  let subrubro2Creados = 0;
  async function getSubrubro2(nombre: string) {
    const key = normalize(nombre);
    const cachedId = subrubro2Cache.get(key);
    if (cachedId) return cachedId;
    const row = await prisma.subrubro2.create({ data: { nomSubrubro2: nombre } });
    subrubro2Cache.set(key, row.codSubrubro2);
    subrubro2Creados++;
    return row.codSubrubro2;
  }

  let count = 0;
  let omitidas = 0;

  // Layout de "HOJA LLAVE" en el archivo de Plate Silver (fila de encabezado
  // en 10, datos desde la fila 11): col1 es sólo un número de grupo/orden
  // (1..6, no un código de empresa — el archivo trae una única empresa,
  // "PLATE SILVER", ver fila 2), col2 CUENTA, col10 PARTIDA PATRIMONIAL,
  // col11 RUBRO, col12 SUBRUBRO, col13 SUBRUBRO2 y col14 SUBRUBRO3 (estas
  // dos últimas vienen vacías en todo el archivo).
  for (let r = 11; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cuenta = cellText(row.getCell(2));
    if (!cuenta) continue;

    const partidaNombre = cellText(row.getCell(10));
    const rubroColumna = cellText(row.getCell(11));
    const subrubroColumna = cellText(row.getCell(12));
    const subrubro2Columna = cellText(row.getCell(13));
    const subrubro3Columna = cellText(row.getCell(14));

    if (!partidaNombre || !rubroColumna || !subrubroColumna) {
      console.warn(`Fila ${r}: cuenta "${cuenta}" sin Partida/Rubro/Subrubro, se omite.`);
      omitidas++;
      continue;
    }

    const esResultado = partidaNombre === "INGRESOS" || partidaNombre === "EGRESOS";
    const grupo: RolTipoPartida | "OTRO" = defaultRolPartida(partidaNombre) ?? "OTRO";

    let rubroNombre: string;
    if (esResultado) {
      const bucketKey = normalize(rubroColumna);
      const rubroCanonico = BUCKET_A_RUBRO[bucketKey];
      if (!rubroCanonico) {
        console.warn(
          `Fila ${r}: cuenta "${cuenta}" de Resultado sin clasificación de RUBRO válida ("${rubroColumna}"), se omite.`
        );
        omitidas++;
        continue;
      }
      rubroNombre = rubroCanonico;
    } else {
      rubroNombre = rubroColumna;
    }

    const partida = await getPartida(partidaNombre);
    const rubroId = await getRubro(rubroNombre, partidaNombre, grupo);
    const subrubroId = await getSubrubro(subrubroColumna);
    // El archivo no trae SUBRUBRO2/SUBRUBRO3 para ninguna cuenta (columnas
    // vacías en todo "HOJA LLAVE", verificado fila por fila) — se respeta
    // eso y quedan null; si alguna vez aparecieran, se cargan igual (mismo
    // patrón de reuso por nombre normalizado que el resto de los catálogos).
    const subrubro2Id = subrubro2Columna ? await getSubrubro2(subrubro2Columna) : null;
    if (subrubro3Columna) {
      console.warn(`Fila ${r}: cuenta "${cuenta}" trae SUBRUBRO3 ("${subrubro3Columna}") inesperado, revisar.`);
    }

    await prisma.planDeCuentas.upsert({
      where: { empresaId_cuenta: { empresaId: EMPRESA_ID, cuenta } },
      update: {
        partidaPatrimonialId: partida.id,
        rubroId,
        subrubroId,
        subrubro2Id,
      },
      create: {
        empresaId: EMPRESA_ID,
        cuenta,
        partidaPatrimonialId: partida.id,
        rubroId,
        subrubroId,
        subrubro2Id,
      },
    });
    count++;
  }

  console.log(`Listo: ${count} cuentas importadas (Plate Silver).`);
  if (omitidas > 0) console.log(`${omitidas} fila(s) omitida(s) — ver avisos arriba.`);
  console.log(
    `Catálogo: ${partidaCreadas} PartidaPatrimonial nueva(s), ${rubroCreados} Rubro nuevo(s), ${subrubroCreados} Subrubro nuevo(s), ${subrubro2Creados} Subrubro2 nuevo(s).`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
