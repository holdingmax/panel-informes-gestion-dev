// Importador único de datos históricos/de puesta en marcha.
//
// Reemplaza a los 11 scripts por-empresa que vivían sueltos en prisma/
// (movidos a prisma/legacy/ como referencia, ver README.md). Cada uno se
// corrió una sola vez para cargar los datos iniciales de una empresa/unidad
// de negocio — este archivo unifica la lógica común (cliente de Prisma,
// lectura de Excel, helpers de celda, escritura final) y deja lo que
// realmente cambia entre empresas en objetos de configuración.
//
// Uso:
//   npx tsx prisma/importar.ts --tipo plan|bsys|historicos|series \
//     --empresa <codEmp o nombre> --archivo <ruta al xlsx> \
//     [--periodo AAAA-MM] [--hasta AAAA-MM]
//
// Ver la sección "Importadores" del README.md para el detalle de --empresa
// (los alias reconocidos por tipo) y de los flags opcionales.
import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { RolTipoPartida } from "../src/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ============================================================
// Helpers comunes de lectura de celdas ExcelJS
// ============================================================

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

// Mayúsculas, sin acentos, espacios colapsados — para comparar nombres de
// Rubro/Subrubro/Partida contra el catálogo ya existente en la base sin
// depender de que la redacción de cada planilla sea idéntica letra a letra.
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Para resolver --empresa contra los alias de cada tipo: además de
// normalize(), saca espacios y guiones para que "Plate Silver", "plate-silver"
// y "PLATESILVER" caigan en la misma clave.
function normalizeAlias(s: string): string {
  return normalize(s).replace(/[\s-]+/g, "");
}

// ============================================================
// CLI: parseo de --tipo / --empresa / --archivo / --periodo / --hasta
// ============================================================

type Tipo = "plan" | "bsys" | "historicos" | "series";

type Args = {
  tipo: Tipo;
  empresa: string;
  archivo: string;
  periodo?: string; // AAAA-MM, opcional (tipo=bsys)
  hasta?: string; // AAAA-MM, opcional (tipo=historicos)
};

const USO =
  "Uso: npx tsx prisma/importar.ts --tipo plan|bsys|historicos|series " +
  '--empresa <codEmp o nombre> --archivo "<ruta al xlsx>" [--periodo AAAA-MM] [--hasta AAAA-MM]';

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const nombre = arg.slice(2);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith("--")) {
      throw new Error(`${USO}\nFalta el valor de --${nombre}.`);
    }
    flags.set(nombre, valor);
    i++;
  }

  const tipo = flags.get("tipo");
  const empresa = flags.get("empresa");
  const archivo = flags.get("archivo");
  if (tipo !== "plan" && tipo !== "bsys" && tipo !== "historicos" && tipo !== "series") {
    throw new Error(`${USO}\n--tipo debe ser plan, bsys, historicos o series.`);
  }
  if (!empresa) throw new Error(`${USO}\nFalta --empresa.`);
  if (!archivo) throw new Error(`${USO}\nFalta --archivo.`);

  return { tipo, empresa, archivo, periodo: flags.get("periodo"), hasta: flags.get("hasta") };
}

function parsePeriodoFlag(valor: string | undefined, nombreFlag: string): { mes: number; anio: number } | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(valor);
  if (!m) throw new Error(`--${nombreFlag} debe tener el formato AAAA-MM (recibido: "${valor}").`);
  return { anio: Number(m[1]), mes: Number(m[2]) };
}

// ============================================================
// TIPO: plan (Plan de Cuentas)
// ============================================================
//
// Hay dos algoritmos genuinamente distintos entre los 5 scripts originales,
// no solo distinta configuración:
//
// - El script genérico (import-plan-de-cuentas.ts, usado para dar de alta el
//   Plan de Cuentas de una empresa nueva antes de que tenga su propio script
//   dedicado) hace upserts directos por nombre único de Rubro/Subrubro y no
//   se preocupa por colisiones de nombre entre empresas.
// - Los 4 scripts dedicados (Havanna, LV12, Bradenton, Plate Silver) agregan
//   detección de colisión de Rubro (un mismo nombre, p.ej. "CORPORATE", puede
//   significar Activo en una empresa y Pasivo en otra) y por eso comparten
//   una máquina de catálogo (getPartida/getRubro/getSubrubro) más elaborada.
//
// Se preserva esa distinción: importarPlanGenerico() por un lado,
// importarPlanColisionAware() + PLAN_CONFIGS por el otro.

const NOMBRE_TIPO_POR_ROL: Record<RolTipoPartida, string> = {
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO_NETO: "Patrimonio Neto",
  RESULTADO: "Resultado",
};

// Estos "default" son solo una conveniencia al importar por primera vez una
// Partida/Rubro: el valor real que usa el motor de informes siempre se lee
// de la tabla (editable en Configuración), nunca de esta función.
function defaultRolPartida(partidaNombre: string): RolTipoPartida | undefined {
  const p = partidaNombre.toUpperCase();
  if (p === "INGRESOS" || p === "EGRESOS") return "RESULTADO";
  if (p === "ACTIVO") return "ACTIVO";
  if (p === "PASIVO" || p === "REGULADORA DE PASIVO") return "PASIVO";
  if (p === "PATRIMONIO NETO") return "PATRIMONIO_NETO";
  return undefined; // "CUENTA DE ORDEN" y similares quedan sin clasificar a propósito
}

// ---------- import-plan-de-cuentas.ts (genérico, sin colisión) ----------

async function importarPlanGenerico(empresaNombre: string, filePath: string): Promise<void> {
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
  const tipoIdPorRolCache = new Map<RolTipoPartida, number>();

  async function getTipoIdPorRol(rol: RolTipoPartida): Promise<number> {
    if (tipoIdPorRolCache.has(rol)) return tipoIdPorRolCache.get(rol)!;
    const row =
      (await prisma.tipoPartida.findFirst({ where: { rol } })) ??
      (await prisma.tipoPartida.create({ data: { nomTipo: NOMBRE_TIPO_POR_ROL[rol], rol } }));
    tipoIdPorRolCache.set(rol, row.codTipo);
    return row.codTipo;
  }

  async function getPartidaId(nombre: string) {
    if (partidaCache.has(nombre)) return partidaCache.get(nombre)!;
    const rol = defaultRolPartida(nombre);
    const tipoId = rol ? await getTipoIdPorRol(rol) : null;
    const row = await prisma.partidaPatrimonial.upsert({
      where: { nomPartida: nombre },
      update: {},
      create: { nomPartida: nombre, tipoId },
    });
    partidaCache.set(nombre, row.codPartida);
    return row.codPartida;
  }

  async function getRubroId(nombre: string, partidaPatrimonialId: number) {
    if (rubroCache.has(nombre)) return rubroCache.get(nombre)!;
    const row = await prisma.rubro.upsert({
      where: { nomRubro: nombre },
      update: {},
      create: { nomRubro: nombre, partidaPatrimonialId },
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

    const partidaPatrimonialId = await getPartidaId(partidaNombre);
    const [rubroId, subrubroId, subrubro2Id, subrubro3Id] = await Promise.all([
      getRubroId(rubroNombre, partidaPatrimonialId),
      getSubrubroId(subrubroNombre),
      nivel2Nombre ? getSubrubro2Id(nivel2Nombre) : Promise.resolve(null),
      nivel3Nombre ? getSubrubro3Id(nivel3Nombre) : Promise.resolve(null),
    ]);

    await prisma.planDeCuentas.upsert({
      where: { empresaId_cuenta: { empresaId: empresa.codEmp, cuenta } },
      update: { rubroId, subrubroId, subrubro2Id, subrubro3Id },
      create: { empresaId: empresa.codEmp, cuenta, rubroId, subrubroId, subrubro2Id, subrubro3Id },
    });
    count++;
  }

  let rubrosBackfilled = 0;
  for (const [rubroNombre, partidaNombre] of rubroPartidaSeen) {
    const rubroId = rubroCache.get(rubroNombre)!;
    const actual = await prisma.rubro.findUnique({ where: { codRubro: rubroId } });
    if (actual && actual.partidaPatrimonialId === null) {
      const partidaPatrimonialId = await getPartidaId(partidaNombre);
      await prisma.rubro.update({ where: { codRubro: rubroId }, data: { partidaPatrimonialId } });
      rubrosBackfilled++;
    }
  }

  let partidasBackfilled = 0;
  for (const [partidaNombre, partidaId] of partidaCache) {
    const actual = await prisma.partidaPatrimonial.findUnique({ where: { codPartida: partidaId } });
    if (actual && actual.tipoId === null) {
      const rol = defaultRolPartida(partidaNombre);
      if (rol) {
        const tipoId = await getTipoIdPorRol(rol);
        await prisma.partidaPatrimonial.update({ where: { codPartida: partidaId }, data: { tipoId } });
        partidasBackfilled++;
      }
    }
  }

  console.log(`Listo: ${count} cuentas del Plan de Cuentas de "${empresaNombre}" importadas.`);
  if (rubrosBackfilled > 0) {
    console.log(`Se clasificó Partida Patrimonial por defecto en ${rubrosBackfilled} rubro(s) existentes.`);
  }
  if (partidasBackfilled > 0) {
    console.log(`Se clasificó Tipo (Balance/Resultado) por defecto en ${partidasBackfilled} partida(s) existentes.`);
  }
}

// ---------- Scripts dedicados con detección de colisión de Rubro ----------

type Grupo = RolTipoPartida | "OTRO";

// Lo que cada config extrae de una fila, ya traducido a nombres canónicos —
// la máquina de catálogo (getPartida/getRubro/getSubrubro) es 100% genérica
// a partir de acá.
type ClasifCuenta = {
  partidaNombre: string;
  rubroNombre: string;
  subrubroNombre: string;
  subrubro2Nombre?: string | null;
  subrubro3Nombre?: string | null;
  grupo: Grupo;
};

type PlanConfig = {
  mensajeEmpresa: string;
  hojaNombre: string;
  startRow: number;
  // Si está definido, la fila trae el código de empresa en esta columna
  // (empresas múltiples por archivo); si no, todas las filas van a
  // resolverEmpresaId() sin mirar ninguna columna (archivo de una sola
  // empresa).
  colEmpresaCodigo?: number;
  colCuenta: number;
  // Arma (o resuelve) el mapa empresaCodigo -> empresaId. Para Havanna esto
  // hace writes (rename + creación de la segunda empresa) porque así lo hacía
  // el script original.
  resolverEmpresas: () => Promise<Map<string, number> | number>;
  // Precarga rubroGrupoAsignado con el grupo real de los Rubros que YA existen
  // en la base (no solo los que aparezcan en este archivo) — Bradenton y
  // Plate Silver lo necesitan porque el catálogo ya trae Rubros de otras
  // empresas; Havanna y LV12 no lo hacían (ver comentario en cada script
  // original).
  precargarRubroGrupoDesdeHistorial: boolean;
  // Extrae y traduce los nombres de Partida/Rubro/Subrubro de una fila.
  // Devuelve null si la fila debe omitirse (y ya hizo su propio
  // console.warn con el motivo, igual que el script original).
  leerClasificacion: (row: ExcelJS.Row, r: number, cuenta: string, empresaCodigo: string) => ClasifCuenta | null;
};

// LV12/Havanna: bucket de 5 nombres que el motor de ER necesita como Rubro
// (Ventas/Costos directos-variables/Gastos Fijos Operativos/Expensas/Otras
// Ganancias y Perdidas) — cada empresa lo trae en una columna distinta y con
// una redacción distinta, pero apunta siempre a estos mismos 5 nombres ya
// existentes en la base.
const BUCKET_LV12: Record<string, string> = {
  VENTAS: "VENTAS",
  "COSTOS DIRECTOS/VARIABLES": "Costos directos/variables",
  "COSTOS FIJOS": "Gastos Fijos Operativos",
  EXPENSAS: "EXPENSAS",
  "OTRAS GANANCIAS Y PERDIDAS": "Otras Ganancias y Perdidas",
};

const BUCKET_HAVANNA: Record<string, string> = {
  VENTAS: "VENTAS",
  "COSTOS DIRECTOS/VARIABLES": "Costos directos/variables",
  "GASTOS FIJOS OPERATIVOS": "Gastos Fijos Operativos",
  EXPENSAS: "EXPENSAS",
  "OTRAS GANANCIAS Y PERDIDAS": "Otras Ganancias y Perdidas",
};

const BUCKET_BRADENTON: Record<string, string> = {
  VENTAS: "VENTAS",
  "OTROS INGRESOS": "Otras Ganancias y Perdidas",
  "GASTOS FIJOS OPERATIVOS": "Gastos Fijos Operativos",
  "COSTOS DIRECTOS DE VENTAS": "Costos directos/variables",
  "OTRAS GANANCIAS Y PERDIDAS": "Otras Ganancias y Perdidas",
};

const BUCKET_PLATE_SILVER: Record<string, string> = {
  VENTAS: "VENTAS",
  "COSTOS DIRECTO DE VENTA": "Costos directos/variables",
  "COSTOS DIRECTOS/VARIABLES": "Costos directos/variables",
  "GASTOS FIJOS OPERATIVOS": "Gastos Fijos Operativos",
  EXPENSAS: "EXPENSAS",
  "OTRAS GANANCIAS Y PERDIDAS": "Otras Ganancias y Perdidas",
};

// Havanna usa códigos cortos para algunas Partidas en su columna de Partida
// (p. ej. "PN"); se traducen a los nombres canónicos ya existentes en la
// base (compartidos con LV12) para no crear un duplicado como "PN" al lado
// de "PATRIMONIO NETO".
const PARTIDA_CANONICA_HAVANNA: Record<string, string> = {
  ACTIVO: "ACTIVO",
  PASIVO: "PASIVO",
  PN: "PATRIMONIO NETO",
  INGRESOS: "INGRESOS",
  EGRESOS: "EGRESOS",
};

const PLAN_CONFIGS: Record<string, PlanConfig> = {
  havanna: {
    mensajeEmpresa: "PANINI + TUCSON",
    hojaNombre: "HOJA LLAVE",
    startRow: 6,
    colEmpresaCodigo: 1,
    colCuenta: 2,
    precargarRubroGrupoDesdeHistorial: false,
    resolverEmpresas: async () => {
      const UNIDAD_NEGOCIO_ID = 3; // Havanna Argentina
      // La empresa placeholder (codEmp=3, "Havanna Argentina", vacía) se
      // renombra a la primera empresa real que trae el archivo ("PANINI");
      // "TUCSON" es una segunda empresa real dentro de la misma Unidad de
      // Negocio y se crea si todavía no existe.
      const panini = await prisma.empresa.update({ where: { codEmp: 3 }, data: { nombreEmp: "PANINI" } });
      let tucson = await prisma.empresa.findFirst({
        where: { unidadNegocioId: UNIDAD_NEGOCIO_ID, nombreEmp: "TUCSON" },
      });
      if (!tucson) {
        tucson = await prisma.empresa.create({ data: { nombreEmp: "TUCSON", unidadNegocioId: UNIDAD_NEGOCIO_ID } });
      }
      return new Map<string, number>([
        ["PANINI", panini.codEmp],
        ["TUCSON", tucson.codEmp],
      ]);
    },
    leerClasificacion: (row, r, cuenta, empresaCodigo) => {
      const partidaRaw = cellText(row.getCell(17));
      const rubroColumna = cellText(row.getCell(18));
      const subrubroColumna = cellText(row.getCell(19));
      const subrubro2Columna = cellText(row.getCell(20)); // solo se usa como clave de bucket, nunca se guarda

      if (!partidaRaw || !rubroColumna) {
        console.warn(`Fila ${r}: cuenta "${cuenta}" (${empresaCodigo}) sin Partida/Rubro, se omite.`);
        return null;
      }

      let partidaNombre = PARTIDA_CANONICA_HAVANNA[partidaRaw.toUpperCase()] ?? partidaRaw;
      const esResultado = partidaNombre === "INGRESOS" || partidaNombre === "EGRESOS";

      // Caso especial verificado contra la hoja de referencia "Origen y
      // Aplic Fondos": el Rubro "CORPORATE" en Havanna son préstamos entre
      // partes relacionadas que la propia planilla de origen consolida en
      // UNA sola posición neta del lado del Activo — sin este ajuste el
      // Balance no cierra contra la referencia. Se fuerza entonces la
      // Partida de estas cuentas de Pasivo a ACTIVO para que terminen en el
      // mismo Rubro/grupo que las de Activo.
      if (!esResultado && normalize(rubroColumna) === "CORPORATE" && partidaNombre === "PASIVO") {
        partidaNombre = "ACTIVO";
      }

      const grupo: Grupo = defaultRolPartida(partidaNombre) ?? "OTRO";

      let rubroNombre: string;
      let subrubroNombre: string;
      if (esResultado) {
        const rubroCanonico = BUCKET_HAVANNA[normalize(subrubro2Columna)];
        if (!rubroCanonico) {
          console.warn(
            `Fila ${r}: cuenta "${cuenta}" (${empresaCodigo}) de Resultado sin clasificación de SUBRUBRO 2 válida ("${subrubro2Columna}"), se omite.`
          );
          return null;
        }
        rubroNombre = rubroCanonico;
        subrubroNombre = subrubroColumna || rubroCanonico;
      } else {
        rubroNombre = rubroColumna;
        // Havanna no trae SUBRUBRO para cuentas de Balance; se usa el propio
        // nombre de Rubro como Subrubro.
        subrubroNombre = subrubroColumna || rubroColumna;
      }

      return { partidaNombre, rubroNombre, subrubroNombre, subrubro2Nombre: null, grupo };
    },
  },

  lv12: {
    mensajeEmpresa: "LV12 + Info",
    hojaNombre: "HOJA LLAVE",
    startRow: 6,
    colEmpresaCodigo: 1,
    colCuenta: 2,
    precargarRubroGrupoDesdeHistorial: false,
    resolverEmpresas: async () =>
      new Map<string, number>([
        ["LV12", 4],
        ["Info", 5],
      ]),
    leerClasificacion: (row, r, cuenta, empresaCodigo) => {
      const partidaNombre = cellText(row.getCell(16));
      const rubroColumna = cellText(row.getCell(17));
      const subrubroColumna = cellText(row.getCell(18));
      const paraRdoColumna = cellText(row.getCell(19));
      const presentacionColumna = cellText(row.getCell(20));

      if (!partidaNombre || !rubroColumna || !subrubroColumna) {
        console.warn(`Fila ${r}: cuenta "${cuenta}" (${empresaCodigo}) sin Partida/Rubro/Subrubro, se omite.`);
        return null;
      }

      const esResultado = partidaNombre === "INGRESOS" || partidaNombre === "EGRESOS";
      const grupo: Grupo = partidaNombre === "CUENTA DE ORDEN" ? "OTRO" : (defaultRolPartida(partidaNombre) ?? "OTRO");

      let rubroNombre: string;
      let subrubro2Nombre: string | null;
      if (esResultado) {
        const rubroCanonico = BUCKET_LV12[normalize(presentacionColumna)];
        if (!rubroCanonico) {
          console.warn(
            `Fila ${r}: cuenta "${cuenta}" (${empresaCodigo}) de Resultado sin clasificación de presentación válida ("${presentacionColumna}"), se omite.`
          );
          return null;
        }
        rubroNombre = rubroCanonico;
        subrubro2Nombre = paraRdoColumna && paraRdoColumna !== "0" ? paraRdoColumna : null;
      } else {
        rubroNombre = rubroColumna;
        subrubro2Nombre = null;
      }

      return { partidaNombre, rubroNombre, subrubroNombre: subrubroColumna, subrubro2Nombre, grupo };
    },
  },

  bradenton: {
    mensajeEmpresa: "Bradenton Gas Station USA",
    hojaNombre: "HOJA LLAVE",
    startRow: 11,
    colCuenta: 2,
    precargarRubroGrupoDesdeHistorial: true,
    resolverEmpresas: async () => 8, // Bradenton Gas Station USA
    leerClasificacion: (row, r, cuenta) => {
      const partidaNombre = cellText(row.getCell(10));
      const rubroColumna = cellText(row.getCell(11));
      const subrubroColumna = cellText(row.getCell(12));
      const subrubro2Columna = cellText(row.getCell(13));
      const subrubro3Columna = cellText(row.getCell(14));

      if (!partidaNombre || !rubroColumna) {
        console.warn(`Fila ${r}: cuenta "${cuenta}" sin Partida/Rubro, se omite.`);
        return null;
      }

      const esResultado = partidaNombre === "INGRESOS" || partidaNombre === "EGRESOS";
      const grupo: Grupo = defaultRolPartida(partidaNombre) ?? "OTRO";

      let rubroNombre = rubroColumna;
      if (esResultado) {
        const bucket = BUCKET_BRADENTON[normalize(rubroColumna)];
        if (!bucket) {
          console.warn(
            `Fila ${r}: cuenta "${cuenta}" de Resultado con Rubro "${rubroColumna}" sin mapeo a los 5 buckets de ER, se omite.`
          );
          return null;
        }
        rubroNombre = bucket;
      }

      return {
        partidaNombre,
        rubroNombre,
        subrubroNombre: subrubroColumna || rubroColumna,
        subrubro2Nombre: subrubro2Columna || null,
        subrubro3Nombre: subrubro3Columna || null,
        grupo,
      };
    },
  },

  "plate-silver": {
    mensajeEmpresa: "Plate Silver",
    hojaNombre: "HOJA LLAVE",
    startRow: 11,
    colCuenta: 2,
    precargarRubroGrupoDesdeHistorial: true,
    resolverEmpresas: async () => 7, // Plate Silver (unidadNegocioId: 6) — única empresa en este archivo
    leerClasificacion: (row, r, cuenta) => {
      const partidaNombre = cellText(row.getCell(10));
      const rubroColumna = cellText(row.getCell(11));
      const subrubroColumna = cellText(row.getCell(12));
      const subrubro2Columna = cellText(row.getCell(13));
      const subrubro3Columna = cellText(row.getCell(14));

      if (!partidaNombre || !rubroColumna || !subrubroColumna) {
        console.warn(`Fila ${r}: cuenta "${cuenta}" sin Partida/Rubro/Subrubro, se omite.`);
        return null;
      }

      const esResultado = partidaNombre === "INGRESOS" || partidaNombre === "EGRESOS";
      const grupo: Grupo = defaultRolPartida(partidaNombre) ?? "OTRO";

      let rubroNombre = rubroColumna;
      if (esResultado) {
        const bucket = BUCKET_PLATE_SILVER[normalize(rubroColumna)];
        if (!bucket) {
          console.warn(`Fila ${r}: cuenta "${cuenta}" de Resultado sin clasificación de RUBRO válida ("${rubroColumna}"), se omite.`);
          return null;
        }
        rubroNombre = bucket;
      }

      // El archivo no trae SUBRUBRO2/SUBRUBRO3 para ninguna cuenta — si
      // alguna vez aparecieran, se cargan igual (mismo patrón de reuso por
      // nombre normalizado que el resto de los catálogos); SUBRUBRO3 nunca
      // se guarda, solo se avisa si aparece (igual que el script original).
      if (subrubro3Columna) {
        console.warn(`Fila ${r}: cuenta "${cuenta}" trae SUBRUBRO3 ("${subrubro3Columna}") inesperado, revisar.`);
      }

      return {
        partidaNombre,
        rubroNombre,
        subrubroNombre: subrubroColumna,
        subrubro2Nombre: subrubro2Columna || null,
        grupo,
      };
    },
  },
};

async function importarPlanColisionAware(config: PlanConfig, filePath: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet(config.hojaNombre);
  if (!sheet) throw new Error(`No se encontró la hoja "${config.hojaNombre}" en el archivo.`);

  const empresas = await config.resolverEmpresas();
  const empresaPorCodigo = empresas instanceof Map ? empresas : null;
  const empresaIdFija = empresas instanceof Map ? null : empresas;

  const partidaCache = new Map<string, { id: number; rol: RolTipoPartida | null }>();
  for (const p of await prisma.partidaPatrimonial.findMany({ include: { tipo: true } })) {
    partidaCache.set(p.nomPartida, { id: p.codPartida, rol: p.tipo?.rol ?? null });
  }

  const tipoIdPorRolCache = new Map<RolTipoPartida, number>();
  async function getTipoIdPorRol(rol: RolTipoPartida): Promise<number> {
    if (tipoIdPorRolCache.has(rol)) return tipoIdPorRolCache.get(rol)!;
    const row =
      (await prisma.tipoPartida.findFirst({ where: { rol } })) ??
      (await prisma.tipoPartida.create({ data: { nomTipo: NOMBRE_TIPO_POR_ROL[rol], rol } }));
    tipoIdPorRolCache.set(rol, row.codTipo);
    return row.codTipo;
  }

  const rubroCache = new Map<string, number>(); // normalizado -> id (para reuso)
  const rubroGrupoAsignado = new Map<string, Grupo>(); // nombre exacto usado -> grupo
  for (const r of await prisma.rubro.findMany()) rubroCache.set(normalize(r.nomRubro), r.codRubro);

  // Precarga rubroGrupoAsignado con el grupo real de cada Rubro YA existente
  // en la base (no solo el detectado dentro de este archivo) — la Partida
  // Patrimonial vive directo en el Rubro, así que no hace falta inferirla de
  // las cuentas que lo usan ni lidiar con un dato previo ambiguo.
  if (config.precargarRubroGrupoDesdeHistorial) {
    const rubrosExistentes = await prisma.rubro.findMany({
      include: { partidaPatrimonial: { include: { tipo: true } } },
    });
    for (const r of rubrosExistentes) {
      const grupo: Grupo = r.partidaPatrimonial?.tipo?.rol ?? "OTRO";
      rubroGrupoAsignado.set(normalize(r.nomRubro), grupo);
    }
  }

  const subrubroCache = new Map<string, number>();
  for (const s of await prisma.subrubro.findMany()) subrubroCache.set(normalize(s.nomSubrubro), s.codSubrubro);
  const subrubro2Cache = new Map<string, number>();
  for (const s of await prisma.subrubro2.findMany()) subrubro2Cache.set(normalize(s.nomSubrubro2), s.codSubrubro2);
  // Solo lo usa Bradenton (único config con subrubro3Nombre); precargar acá
  // es igual de barato que no hacerlo para las demás empresas.
  const subrubro3Cache = new Map<string, number>();
  for (const s of await prisma.subrubro3.findMany()) subrubro3Cache.set(normalize(s.nomSubrubro3), s.codSubrubro3);

  async function getPartida(nombre: string) {
    const cached = partidaCache.get(nombre);
    if (cached) return cached;
    const rol = defaultRolPartida(nombre);
    const tipoId = rol ? await getTipoIdPorRol(rol) : null;
    const row = await prisma.partidaPatrimonial.create({ data: { nomPartida: nombre, tipoId } });
    const entry = { id: row.codPartida, rol: rol ?? null };
    partidaCache.set(nombre, entry);
    return entry;
  }

  // Evita que un mismo nombre de Rubro (p. ej. "CORPORATE") termine
  // representando, con un solo id, tanto un préstamo otorgado (Activo) como
  // uno recibido (Pasivo) en otra empresa. Si aparece de nuevo con un grupo
  // distinto, se crea un Rubro nuevo con un sufijo aclaratorio.
  async function getRubro(nombreOriginal: string, partidaPatrimonialId: number, grupo: Grupo) {
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

    const row = await prisma.rubro.create({ data: { nomRubro: nombre, partidaPatrimonialId } });
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

  async function getSubrubro3(nombre: string) {
    const key = normalize(nombre);
    const cachedId = subrubro3Cache.get(key);
    if (cachedId) return cachedId;
    const row = await prisma.subrubro3.create({ data: { nomSubrubro3: nombre } });
    subrubro3Cache.set(key, row.codSubrubro3);
    return row.codSubrubro3;
  }

  let count = 0;
  let omitidas = 0;

  for (let r = config.startRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cuenta = cellText(row.getCell(config.colCuenta));

    let empresaCodigo = "";
    let empresaId: number;
    if (config.colEmpresaCodigo) {
      empresaCodigo = cellText(row.getCell(config.colEmpresaCodigo));
      if (!empresaCodigo || !cuenta) continue; // fila vacía u otra cosa
      const resuelto = empresaPorCodigo!.get(empresaCodigo);
      if (!resuelto) {
        console.warn(`Fila ${r}: código de empresa "${empresaCodigo}" no reconocido, se omite.`);
        omitidas++;
        continue;
      }
      empresaId = resuelto;
    } else {
      if (!cuenta) continue;
      empresaId = empresaIdFija!;
    }

    const clasif = config.leerClasificacion(row, r, cuenta, empresaCodigo);
    if (!clasif) {
      omitidas++;
      continue;
    }

    const partida = await getPartida(clasif.partidaNombre);
    const rubroId = await getRubro(clasif.rubroNombre, partida.id, clasif.grupo);
    const subrubroId = await getSubrubro(clasif.subrubroNombre);
    const subrubro2Id = clasif.subrubro2Nombre ? await getSubrubro2(clasif.subrubro2Nombre) : null;
    const subrubro3Id = clasif.subrubro3Nombre ? await getSubrubro3(clasif.subrubro3Nombre) : null;

    await prisma.planDeCuentas.upsert({
      where: { empresaId_cuenta: { empresaId, cuenta } },
      update: { rubroId, subrubroId, subrubro2Id, subrubro3Id },
      create: { empresaId, cuenta, rubroId, subrubroId, subrubro2Id, subrubro3Id },
    });
    count++;
  }

  console.log(`Listo: ${count} cuentas importadas (${config.mensajeEmpresa}).`);
  if (omitidas > 0) console.log(`${omitidas} fila(s) omitida(s) — ver avisos arriba.`);
}

const PLAN_ALIASES: Record<string, string> = {
  HAVANNA: "havanna",
  "3": "havanna",
  PANINI: "havanna",
  TUCSON: "havanna",
  LV12: "lv12",
  "4": "lv12",
  "5": "lv12",
  INFO: "lv12",
  GRUPOLV12: "lv12",
  BRADENTON: "bradenton",
  "8": "bradenton",
  BRADENTONGASSTATION: "bradenton",
  BRADENTONGASSTATIONUSA: "bradenton",
  PLATESILVER: "plate-silver",
  "7": "plate-silver",
  PLATESILVERUSA: "plate-silver",
};

async function importarPlan(empresaArg: string, filePath: string): Promise<void> {
  const key = normalizeAlias(empresaArg);
  const config = PLAN_ALIASES[key];
  if (config) {
    await importarPlanColisionAware(PLAN_CONFIGS[config], filePath);
  } else {
    // Empresa sin script dedicado todavía: se usa el flujo genérico
    // (equivalente a prisma/legacy/import-plan-de-cuentas.ts), tratando
    // --empresa como el nombre literal de la empresa.
    await importarPlanGenerico(empresaArg, filePath);
  }
}

// ============================================================
// TIPO: bsys (Balance de Sumas y Saldos)
// ============================================================

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

type BsysConfig = {
  mensajeEmpresa: string;
  unidadNegocioId: number;
  periodoMesDefault: number;
  periodoAnioDefault: number;
  hojaAcumulado: string;
  hojaMes: string;
  startRowAcumulado: number;
  startRowMes: number;
  resolverEmpresaPorCodigo: () => Promise<Map<string, number>>;
  // Cada empresa lee sus filas con una fórmula distinta (ver comentario en
  // leerHojaHavanna) — no es solo una diferencia de columnas.
  leerHoja: (
    sheet: ExcelJS.Worksheet,
    startRow: number,
    tipo: "MES" | "ACUMULADO",
    fechaCarga: Date,
    empresaPorCodigo: Map<string, number>
  ) => FilaBSyS[];
};

// Debe-Haber neto -> par (Debe, Haber) preservando la convención habitual
// (un solo lado no-cero) para no alterar el neto que de verdad usan
// balance-oya-report.ts y resultado-nominal.ts (siempre Debe-Haber).
function splitNet(net: number): { debe: number; haber: number } {
  return net >= 0 ? { debe: net, haber: 0 } : { debe: 0, haber: -net };
}

// Havanna: la hoja "HOJA LLAVE" (Acumulado) trae columnas de reclasificación
// (Reclasif SI / Reclasif SF, típicamente cheques diferidos o sobregiros
// bancarios reclasificados de Disponibilidades a Deudas Financieras) que hay
// que sumar al saldo crudo para llegar al saldo de presentación real —
// confirmado comparando contra la hoja de referencia "Origen y Aplic
// Fondos". La hoja "SYS 06-2026" (Mes) no trae esta reclasificación, así que
// para esa se pasan reclasifCols=undefined (quedan en 0). LV12 nunca tiene
// esta reclasificación, así que usa leerHojaDirecta en su lugar.
function leerHojaHavanna(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  tipo: "MES" | "ACUMULADO",
  fechaCarga: Date,
  empresaPorCodigo: Map<string, number>,
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
    // el Saldo Final "de presentación" arrastra la reclasificación de Saldo
    // Inicio (Reclasif SI) además de sumar su propia Reclasif SF.
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

function leerHojaDirecta(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  tipo: "MES" | "ACUMULADO",
  fechaCarga: Date,
  empresaPorCodigo: Map<string, number>
): FilaBSyS[] {
  const filas: FilaBSyS[] = [];
  for (let r = startRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const empresaCodigo = cellText(row.getCell(1));
    const cuenta = cellText(row.getCell(2));
    if (!empresaCodigo || !cuenta) continue;

    const empresaId = empresaPorCodigo.get(empresaCodigo);
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

const BSYS_CONFIGS: Record<string, BsysConfig> = {
  havanna: {
    mensajeEmpresa: "Havanna Argentina (PANINI + TUCSON)",
    unidadNegocioId: 3,
    periodoMesDefault: 6,
    periodoAnioDefault: 2026,
    hojaAcumulado: "HOJA LLAVE",
    hojaMes: "SYS 06-2026",
    startRowAcumulado: 6,
    startRowMes: 2,
    resolverEmpresaPorCodigo: async () => {
      const unidadNegocioId = 3;
      const empresas = await prisma.empresa.findMany({ where: { unidadNegocioId } });
      const empresaPorCodigo = new Map<string, number>(empresas.map((e) => [e.nombreEmp, e.codEmp]));
      if (!empresaPorCodigo.has("PANINI") || !empresaPorCodigo.has("TUCSON")) {
        throw new Error(
          'No se encontraron las empresas "PANINI"/"TUCSON" en la Unidad de Negocio Havanna Argentina — corré primero ' +
            "npx tsx prisma/importar.ts --tipo plan --empresa havanna --archivo <ruta>."
        );
      }
      return empresaPorCodigo;
    },
    // Acumulado: mismas columnas 3-8 que LV12, pero con reclasificación en
    // 9/13. Mes: misma disposición de columnas, sin reclasificación, y en
    // hoja separada "SYS 06-2026" (no hay "HOJA LLAVE MES" como en LV12).
    leerHoja: (sheet, startRow, tipo, fechaCarga, empresaPorCodigo) =>
      tipo === "ACUMULADO"
        ? leerHojaHavanna(sheet, startRow, tipo, fechaCarga, empresaPorCodigo, { inicio: 9, final: 13 })
        : leerHojaHavanna(sheet, startRow, tipo, fechaCarga, empresaPorCodigo),
  },
  lv12: {
    mensajeEmpresa: "Grupo LV12 (LV12 + Info)",
    unidadNegocioId: 4,
    periodoMesDefault: 6,
    periodoAnioDefault: 2026,
    hojaAcumulado: "HOJA LLAVE",
    hojaMes: "HOJA LLAVE MES",
    startRowAcumulado: 6,
    startRowMes: 7,
    resolverEmpresaPorCodigo: async () =>
      new Map<string, number>([
        ["LV12", 4],
        ["Info", 5],
      ]),
    leerHoja: leerHojaDirecta,
  },
};

const BSYS_ALIASES: Record<string, string> = {
  HAVANNA: "havanna",
  "3": "havanna",
  PANINI: "havanna",
  TUCSON: "havanna",
  LV12: "lv12",
  "4": "lv12",
  "5": "lv12",
  INFO: "lv12",
  GRUPOLV12: "lv12",
};

async function importarBsys(empresaArg: string, filePath: string, periodo?: { mes: number; anio: number }): Promise<void> {
  const key = BSYS_ALIASES[normalizeAlias(empresaArg)];
  const config = key ? BSYS_CONFIGS[key] : undefined;
  if (!config) {
    throw new Error(
      `--empresa "${empresaArg}" no tiene un importador de BSyS conocido (alias soportados: ${Object.keys(BSYS_ALIASES).join(", ")}).`
    );
  }

  const periodoMes = periodo?.mes ?? config.periodoMesDefault;
  const periodoAnio = periodo?.anio ?? config.periodoAnioDefault;
  const { unidadNegocioId } = config;

  const empresaPorCodigo = await config.resolverEmpresaPorCodigo();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const hojaAcumulado = wb.getWorksheet(config.hojaAcumulado);
  const hojaMes = wb.getWorksheet(config.hojaMes);
  if (!hojaAcumulado) throw new Error(`No se encontró la hoja "${config.hojaAcumulado}".`);
  if (!hojaMes) throw new Error(`No se encontró la hoja "${config.hojaMes}".`);

  const fechaCarga = new Date();

  const filasAcumulado = config.leerHoja(hojaAcumulado, config.startRowAcumulado, "ACUMULADO", fechaCarga, empresaPorCodigo);
  const filasMes = config.leerHoja(hojaMes, config.startRowMes, "MES", fechaCarga, empresaPorCodigo);

  console.log(`Acumulado: ${filasAcumulado.length} filas. Mes: ${filasMes.length} filas.`);

  await prisma.$transaction(async (tx) => {
    await tx.balanceSumasYSaldos.createMany({ data: filasAcumulado.map((f) => ({ ...f, periodoMes, periodoAnio })) });
    await tx.balanceSumasYSaldos.createMany({ data: filasMes.map((f) => ({ ...f, periodoMes, periodoAnio })) });
    await tx.informe.upsert({
      where: { unidadNegocioId_periodoMes_periodoAnio: { unidadNegocioId, periodoMes, periodoAnio } },
      update: {},
      create: { unidadNegocioId, periodoMes, periodoAnio },
    });
  });

  console.log(`Listo: BSyS de ${periodoMes}/${periodoAnio} importado para ${config.mensajeEmpresa}.`);
}

// ============================================================
// TIPO: historicos (Resultados Históricos)
// ============================================================

type CampoResultadoNominal = "ventas" | "costosDirectos" | "gastosOperativos" | "expensas" | "otrasGananciasYPerdidas";

type HistoricosConfig = {
  mensajeEmpresa: string;
  unidadNegocioId: number;
  filaPeriodosRow: number;
  colEtiqueta: number;
  colPeriodoInicio: number;
  campos: Record<string, CampoResultadoNominal>;
  // Havanna nunca completa "Otras Ganancias y perdidas" (queda vacía en
  // todos los períodos) — se trata como 0 en vez de exigir que esté
  // presente, para no descartar todos los períodos.
  requiereOtrasGananciasYPerdidas: boolean;
};

// Nombres de fila tal como vienen en el archivo, mapeados a los campos del
// modelo. Las filas que no están acá (Margen de Contribución, %MC, Resultado
// Operativo, Resultado Neto) son valores derivados que el motor de informes
// calcula al vuelo — no se guardan.
const CAMPOS_HISTORICOS_BASE: Record<string, CampoResultadoNominal> = {
  Ventas: "ventas",
  "Costos directo de ventas": "costosDirectos",
  "Gastos Operativos": "gastosOperativos",
  Expensas: "expensas",
  "Otras Ganancias y perdidas": "otrasGananciasYPerdidas",
};

// LV12 llama "Costos Fijos" a la misma fila que las demás empresas llaman
// "Gastos Operativos" — mismo diccionario base, una sola clave distinta.
const CAMPOS_HISTORICOS_LV12: Record<string, CampoResultadoNominal> = {
  Ventas: "ventas",
  "Costos directo de ventas": "costosDirectos",
  "Costos Fijos": "gastosOperativos",
  Expensas: "expensas",
  "Otras Ganancias y perdidas": "otrasGananciasYPerdidas",
};

const HISTORICOS_CONFIGS: Record<string, HistoricosConfig> = {
  havanna: {
    mensajeEmpresa: "Havanna Argentina",
    unidadNegocioId: 3,
    filaPeriodosRow: 1,
    colEtiqueta: 1,
    colPeriodoInicio: 2,
    campos: CAMPOS_HISTORICOS_BASE,
    requiereOtrasGananciasYPerdidas: false,
  },
  lv12: {
    mensajeEmpresa: "Grupo LV12",
    unidadNegocioId: 4,
    filaPeriodosRow: 1,
    colEtiqueta: 1,
    colPeriodoInicio: 2,
    campos: CAMPOS_HISTORICOS_LV12,
    requiereOtrasGananciasYPerdidas: true,
  },
};

const HISTORICOS_ALIASES: Record<string, string> = {
  HAVANNA: "havanna",
  "3": "havanna",
  LV12: "lv12",
  "4": "lv12",
  GRUPOLV12: "lv12",
};

async function importarHistoricos(empresaArg: string, filePath: string, hasta?: { mes: number; anio: number }): Promise<void> {
  const key = HISTORICOS_ALIASES[normalizeAlias(empresaArg)];
  let config: HistoricosConfig;
  if (key) {
    config = HISTORICOS_CONFIGS[key];
  } else {
    // Sin script dedicado: equivalente a prisma/legacy/import-resultados-historicos.ts,
    // que tomaba la Unidad de Negocio directamente como número y tenía una
    // columna extra de margen (fila de períodos en la 2, etiquetas en la
    // columna 2, valores desde la columna 3).
    const unidadNegocioId = Number(empresaArg);
    if (!Number.isFinite(unidadNegocioId)) {
      throw new Error(
        `--empresa "${empresaArg}" no tiene un importador de Históricos conocido; para una unidad de negocio sin script ` +
          "dedicado pasá directamente su unidadNegocioId numérico."
      );
    }
    config = {
      mensajeEmpresa: `unidad de negocio ${unidadNegocioId}`,
      unidadNegocioId,
      filaPeriodosRow: 2,
      colEtiqueta: 2,
      colPeriodoInicio: 3,
      campos: CAMPOS_HISTORICOS_BASE,
      requiereOtrasGananciasYPerdidas: true,
    };
  }

  const hastaPeriodo = hasta ? new Date(Date.UTC(hasta.anio, hasta.mes - 1, 1)) : null;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");

  const filaPeriodos = sheet.getRow(config.filaPeriodosRow);
  const periodos = new Map<number, Date>(); // columna -> período
  for (let c = config.colPeriodoInicio; c <= sheet.columnCount; c++) {
    const periodo = toDate(cellValue(filaPeriodos.getCell(c)));
    if (periodo) periodos.set(c, periodo);
  }

  const valoresPorPeriodo = new Map<number, Partial<Record<CampoResultadoNominal, number>>>();
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const etiqueta = String(cellValue(row.getCell(config.colEtiqueta)) ?? "").trim();
    const campo = config.campos[etiqueta];
    if (!campo) continue;

    for (const [c, periodo] of periodos) {
      const valor = cellValue(row.getCell(c));
      if (valor === null || valor === undefined || valor === "") continue;
      const key2 = periodo.getTime();
      if (!valoresPorPeriodo.has(key2)) valoresPorPeriodo.set(key2, {});
      valoresPorPeriodo.get(key2)![campo] = Number(valor);
    }
  }

  let count = 0;
  let omitidos = 0;
  for (const [key2, valores] of valoresPorPeriodo) {
    const periodo = new Date(key2);
    if (hastaPeriodo && periodo > hastaPeriodo) continue;

    const completo =
      valores.ventas !== undefined &&
      valores.costosDirectos !== undefined &&
      valores.gastosOperativos !== undefined &&
      valores.expensas !== undefined &&
      (config.requiereOtrasGananciasYPerdidas ? valores.otrasGananciasYPerdidas !== undefined : true);
    if (!completo) {
      console.warn(`Aviso: período ${periodo.toISOString().slice(0, 7)} tiene campos faltantes, se omite.`);
      omitidos++;
      continue;
    }

    const periodoMes = periodo.getUTCMonth() + 1;
    const periodoAnio = periodo.getUTCFullYear();

    await prisma.resultadosHistoricos.upsert({
      where: { unidadNegocioId_periodoMes_periodoAnio: { unidadNegocioId: config.unidadNegocioId, periodoMes, periodoAnio } },
      update: {},
      create: {
        unidadNegocioId: config.unidadNegocioId,
        periodoMes,
        periodoAnio,
        ventas: valores.ventas!,
        costosDirectos: valores.costosDirectos!,
        gastosOperativos: valores.gastosOperativos!,
        expensas: valores.expensas!,
        otrasGananciasYPerdidas: valores.otrasGananciasYPerdidas ?? 0,
      },
    });
    count++;
  }

  console.log(`Listo: ${count} períodos de Resultados Históricos importados (${config.mensajeEmpresa}).`);
  if (omitidos > 0) console.log(`${omitidos} período(s) omitido(s) por datos incompletos.`);
}

// ============================================================
// TIPO: series (Series e Índices)
// ============================================================
//
// A diferencia de plan/bsys/historicos, esta tabla no es por-empresa sino
// por "tipo de tabla" (una serie de índice/dólar que puede servir a más de
// una Unidad de Negocio) — no hay variantes por empresa que unificar. Se
// reusa --empresa para pasar ese tipo de tabla tal cual lo tomaba el script
// original como segundo argumento posicional (ver README.md).

async function importarSeries(tipoTabla: string, filePath: string): Promise<void> {
  const tabla =
    (await prisma.seriesEIndicesTabla.findFirst({ where: { tipoTabla } })) ??
    (await prisma.seriesEIndicesTabla.create({ data: { tipoTabla } }));

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
    if (!periodo || indice === null || indice === undefined || dolar === null || dolar === undefined) continue;

    await prisma.seriesEIndices.upsert({
      where: { tablaId_periodo: { tablaId: tabla.codTabla, periodo } },
      update: { indice: Number(indice), dolar: Number(dolar) },
      create: { tablaId: tabla.codTabla, periodo, indice: Number(indice), dolar: Number(dolar) },
    });
    count++;
  }

  console.log(`Listo: ${count} períodos de Series e Índices importados en la tabla "${tipoTabla}".`);
}

// ============================================================
// Dispatcher
// ============================================================

async function main() {
  const { tipo, empresa, archivo, periodo, hasta } = parseArgs(process.argv.slice(2));

  switch (tipo) {
    case "plan":
      await importarPlan(empresa, archivo);
      break;
    case "bsys":
      await importarBsys(empresa, archivo, parsePeriodoFlag(periodo, "periodo") ?? undefined);
      break;
    case "historicos":
      await importarHistoricos(empresa, archivo, parsePeriodoFlag(hasta, "hasta") ?? undefined);
      break;
    case "series":
      await importarSeries(empresa, archivo);
      break;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
