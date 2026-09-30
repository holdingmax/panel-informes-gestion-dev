import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { CategoriaOrigenAplicacion, RolTipoPartida } from "../../src/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EMPRESA_ID = 8; // Bradenton Gas Station USA

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return String(v.result);
    if ("richText" in v && v.richText) return v.richText.map((t) => t.text).join("");
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
  return undefined;
}

function defaultCategoriaOyA(partidaNombre: string): CategoriaOrigenAplicacion | undefined {
  const p = partidaNombre.toUpperCase();
  if (p === "ACTIVO") return "APLICACION";
  if (p === "PASIVO" || p === "REGULADORA DE PASIVO" || p === "PATRIMONIO NETO") return "ORIGEN";
  return undefined;
}

// Bradenton trae la clasificación de 5 buckets que el motor de ER necesita
// (Ventas/Costos directos/variables/Gastos Fijos Operativos/Expensas/Otras
// Ganancias y Perdidas) directamente en la propia columna RUBRO de las
// cuentas de Resultado — a diferencia de LV12/Havanna, acá no hace falta ir
// a buscarla a otra columna. Igual hay que traducir al nombre EXACTO ya
// existente en la base (compartido con las demás empresas).
const RUBRO_A_BUCKET: Record<string, string> = {
  VENTAS: "VENTAS",
  "OTROS INGRESOS": "Otras Ganancias y Perdidas",
  "GASTOS FIJOS OPERATIVOS": "Gastos Fijos Operativos",
  "COSTOS DIRECTOS DE VENTAS": "Costos directos/variables",
  "OTRAS GANANCIAS Y PERDIDAS": "Otras Ganancias y Perdidas",
};

async function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    throw new Error('Uso: npx tsx prisma/import-plan-de-cuentas-bradenton.ts "<ruta al xlsx>"');
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

  const rubroCache = new Map<string, number>();
  for (const r of await prisma.rubro.findMany()) {
    rubroCache.set(normalize(r.nomRubro), r.codRubro);
  }

  // Semilla del mapa de "grupo ya asignado" a partir del uso REAL ya
  // existente en la base (no solo de lo que se vea en esta importación): un
  // Rubro como "CORPORATE" ya puede estar establecido como ACTIVO por otra
  // empresa (LV12) — si Bradenton lo necesita para una cuenta de PASIVO, hay
  // que crear/reusar la variante "(PASIVO)" en vez de mezclar semánticas
  // incompatibles bajo el mismo id.
  const rubroGrupoAsignado = new Map<string, RolTipoPartida | "OTRO">();
  const planesExistentes = await prisma.planDeCuentas.findMany({
    include: { rubro: true, partidaPatrimonial: { include: { tipo: true } } },
  });
  const rolesPorRubro = new Map<string, Set<string>>();
  for (const p of planesExistentes) {
    const key = normalize(p.rubro.nomRubro);
    const grupo = p.partidaPatrimonial.tipo?.rol ?? "OTRO";
    if (!rolesPorRubro.has(key)) rolesPorRubro.set(key, new Set());
    rolesPorRubro.get(key)!.add(grupo);
  }
  for (const [key, grupos] of rolesPorRubro) {
    if (grupos.size === 1) {
      rubroGrupoAsignado.set(key, [...grupos][0] as RolTipoPartida | "OTRO");
    }
  }

  const subrubroCache = new Map<string, number>();
  for (const s of await prisma.subrubro.findMany()) subrubroCache.set(normalize(s.nomSubrubro), s.codSubrubro);
  const subrubro2Cache = new Map<string, number>();
  for (const s of await prisma.subrubro2.findMany()) subrubro2Cache.set(normalize(s.nomSubrubro2), s.codSubrubro2);
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

  for (let r = 11; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cuenta = cellText(row.getCell(2));
    if (!cuenta) continue;

    const partidaNombre = cellText(row.getCell(10));
    const rubroColumna = cellText(row.getCell(11));
    const subrubroColumna = cellText(row.getCell(12));
    const subrubro2Columna = cellText(row.getCell(13));
    const subrubro3Columna = cellText(row.getCell(14));

    if (!partidaNombre || !rubroColumna) {
      console.warn(`Fila ${r}: cuenta "${cuenta}" sin Partida/Rubro, se omite.`);
      omitidas++;
      continue;
    }

    const esResultado = partidaNombre === "INGRESOS" || partidaNombre === "EGRESOS";
    const grupo: RolTipoPartida | "OTRO" = defaultRolPartida(partidaNombre) ?? "OTRO";

    let rubroNombre = rubroColumna;
    if (esResultado) {
      const bucket = RUBRO_A_BUCKET[normalize(rubroColumna)];
      if (!bucket) {
        console.warn(
          `Fila ${r}: cuenta "${cuenta}" de Resultado con Rubro "${rubroColumna}" sin mapeo a los 5 buckets de ER, se omite.`
        );
        omitidas++;
        continue;
      }
      rubroNombre = bucket;
    }

    const partida = await getPartida(partidaNombre);
    const rubroId = await getRubro(rubroNombre, partidaNombre, grupo);
    const subrubroId = subrubroColumna ? await getSubrubro(subrubroColumna) : await getSubrubro(rubroColumna);
    const subrubro2Id = subrubro2Columna ? await getSubrubro2(subrubro2Columna) : null;
    const subrubro3Id = subrubro3Columna ? await getSubrubro3(subrubro3Columna) : null;

    await prisma.planDeCuentas.upsert({
      where: { empresaId_cuenta: { empresaId: EMPRESA_ID, cuenta } },
      update: {
        partidaPatrimonialId: partida.id,
        rubroId,
        subrubroId,
        subrubro2Id,
        subrubro3Id,
      },
      create: {
        empresaId: EMPRESA_ID,
        cuenta,
        partidaPatrimonialId: partida.id,
        rubroId,
        subrubroId,
        subrubro2Id,
        subrubro3Id,
      },
    });
    count++;
  }

  console.log(`Listo: ${count} cuentas importadas (Bradenton Gas Station USA).`);
  if (omitidas > 0) console.log(`${omitidas} fila(s) omitida(s) — ver avisos arriba.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
