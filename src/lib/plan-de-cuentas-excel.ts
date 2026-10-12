import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { normalizarTexto, type FilaCarga } from "@/lib/plan-de-cuentas-carga-masiva-core";

// Sin "use server": helpers de Excel que se llaman desde la acción de carga
// masiva y desde la ruta que descarga el archivo de referencia.

export const ENCABEZADOS_CARGA = [
  "Empresa",
  "Cuenta",
  "Partida",
  "Rubro",
  "Subrubro",
  "Subrubro 2",
  "Subrubro 3",
] as const;

const HOJA_CARGA = "Carga masiva";

type Fila = Record<string, string | number | boolean | Date | null>;

function agregarHoja(wb: ExcelJS.Workbook, nombre: string, columnas: string[], filas: Fila[]) {
  const ws = wb.addWorksheet(nombre);
  ws.columns = columnas.map((c) => ({ header: c, key: c }));
  for (const f of filas) ws.addRow(f);

  const cabecera = ws.getRow(1);
  cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecera.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  cabecera.alignment = { vertical: "middle", wrapText: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  columnas.forEach((c, i) => {
    const largoMax = Math.max(c.length, ...filas.slice(0, 500).map((f) => String(f[c] ?? "").length));
    ws.getColumn(i + 1).width = Math.min(Math.max(largoMax + 2, 10), 60);
    if (filas.some((f) => f[c] instanceof Date)) ws.getColumn(i + 1).numFmt = "yyyy-mm-dd hh:mm";
  });
  return ws;
}

const ABREV_NOF: Record<string, string> = { OPERATIVO: "CTO", NO_OPERATIVO: "ONP", FINANCIAMIENTO: "ARS" };

// Excel de referencia para armar el archivo de la carga masiva (a mano o con
// una IA): las instrucciones, una hoja "Carga masiva" con los encabezados que
// la carga espera, y una hoja por tabla con TODOS sus valores vigentes. Las
// hojas Empresa y Cuenta se limitan a las Empresas de esta Unidad.
export async function generarExcelReferencia(codUnidad: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Panel de Informes de Gestión";
  wb.created = new Date();

  const instrucciones = wb.addWorksheet("Instrucciones");
  instrucciones.getColumn(1).width = 110;
  [
    "CARGA MASIVA DEL PLAN DE CUENTAS",
    "",
    'Completá la hoja "Carga masiva" con una fila por cuenta y subila desde Configuración → Plan de Cuentas → Carga masiva.',
    "",
    "Columnas: Empresa, Cuenta, Partida, Rubro, Subrubro, Subrubro 2, Subrubro 3.",
    "• Cuenta es obligatoria y SIEMPRE tiene que empezar con la secuencia de números del sistema contable (ej. 5.00.29.06 - MOVILIDAD Y VIATICO). Una cuenta sin números al comienzo se descarta.",
    "• Las demás columnas pueden quedar vacías. Si las completás, el valor tiene que ser uno de los que figuran en la hoja de esa tabla (Empresa, Partida, Rubro, Subrubro, Subrubro 2, Subrubro 3), escrito igual.",
    "• Empresa: si la unidad tiene una sola empresa se puede dejar vacía; si tiene varias, hay que indicarla.",
    "• Partida: no se guarda en la cuenta (sale del Rubro). Si completás Partida y Rubro, el rubro tiene que pertenecer a esa partida.",
    "• Si una cuenta ya existe en el plan de la empresa (mismos números al comienzo del nombre, aunque el resto del texto sea distinto), se descarta: los cambios se hacen a mano con Editar/Eliminar.",
    "• Las hojas Empresa y Cuenta (limitadas a las empresas de esta unidad), Partida, Rubro y Subrubro muestran los valores vigentes al momento de descargar este archivo.",
  ].forEach((texto, i) => {
    const celda = instrucciones.getCell(i + 1, 1);
    celda.value = texto;
    celda.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) celda.font = { bold: true, size: 14 };
  });

  agregarHoja(wb, HOJA_CARGA, [...ENCABEZADOS_CARGA], []);

  const vinculos = await prisma.empresaUnidad.findMany({
    where: { unidadNegocioId: codUnidad },
    select: { empresaId: true },
  });
  const empresaIds = vinculos.map((v) => v.empresaId);

  const empresas = await prisma.empresa.findMany({
    where: { codEmp: { in: empresaIds } },
    orderBy: { codEmp: "asc" },
    include: {
      unidades: { select: { unidadNegocio: { select: { codUnidad: true, nombreUnidad: true } } } },
      monedaPrimaria: true,
      monedaSecundaria: true,
      monedaActualiza: true,
      _count: { select: { planDeCuentas: true } },
    },
  });
  const moneda = (m: { nomMoneda: string; simbolo: string } | null) => (m ? `${m.nomMoneda} (${m.simbolo})` : null);
  agregarHoja(
    wb,
    "Empresa",
    [
      "codEmp", "nombreEmp", "comparteBsys", "unidades (códigos)", "unidades (nombres)",
      "monedaPrimariaId", "monedaPrimaria", "presentaEnMiles", "monedaSecundariaId", "monedaSecundaria",
      "actualiza", "monedaActualizaId", "monedaActualiza", "cantidad de cuentas", "createdAt", "updatedAt",
    ],
    empresas.map((e) => ({
      codEmp: e.codEmp,
      nombreEmp: e.nombreEmp,
      comparteBsys: e.comparteBsys,
      "unidades (códigos)": e.unidades.map((u) => u.unidadNegocio.codUnidad).join(", "),
      "unidades (nombres)": e.unidades.map((u) => u.unidadNegocio.nombreUnidad).join(", "),
      monedaPrimariaId: e.monedaPrimariaId,
      monedaPrimaria: moneda(e.monedaPrimaria),
      presentaEnMiles: e.presentaEnMiles,
      monedaSecundariaId: e.monedaSecundariaId,
      monedaSecundaria: moneda(e.monedaSecundaria),
      actualiza: e.actualiza,
      monedaActualizaId: e.monedaActualizaId,
      monedaActualiza: moneda(e.monedaActualiza),
      "cantidad de cuentas": e._count.planDeCuentas,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }))
  );

  const cuentas = await prisma.planDeCuentas.findMany({
    where: { empresaId: { in: empresaIds } },
    orderBy: [{ empresaId: "asc" }, { cuenta: "asc" }],
    include: {
      empresa: { select: { nombreEmp: true } },
      rubro: { select: { nomRubro: true, partidaPatrimonial: { select: { nomPartida: true } } } },
      subrubro: { select: { nomSubrubro: true } },
      subrubro2: { select: { nomSubrubro2: true } },
      subrubro3: { select: { nomSubrubro3: true } },
      unidadNegocio: { select: { nombreUnidad: true } },
    },
  });
  agregarHoja(
    wb,
    "Cuenta",
    [
      "id", "empresaId", "empresa", "cuenta", "rubroId", "rubro", "partida (del rubro)",
      "subrubroId", "subrubro", "subrubro2Id", "subrubro2", "subrubro3Id", "subrubro3",
      "unidadNegocioId (cuit compartido)", "cuit compartido",
    ],
    cuentas.map((c) => ({
      id: c.id,
      empresaId: c.empresaId,
      empresa: c.empresa.nombreEmp,
      cuenta: c.cuenta,
      rubroId: c.rubroId,
      rubro: c.rubro?.nomRubro ?? null,
      "partida (del rubro)": c.rubro?.partidaPatrimonial?.nomPartida ?? null,
      subrubroId: c.subrubroId,
      subrubro: c.subrubro?.nomSubrubro ?? null,
      subrubro2Id: c.subrubro2Id,
      subrubro2: c.subrubro2?.nomSubrubro2 ?? null,
      subrubro3Id: c.subrubro3Id,
      subrubro3: c.subrubro3?.nomSubrubro3 ?? null,
      "unidadNegocioId (cuit compartido)": c.unidadNegocioId,
      "cuit compartido": c.unidadNegocio?.nombreUnidad ?? null,
    }))
  );

  const partidas = await prisma.partidaPatrimonial.findMany({ orderBy: { codPartida: "asc" }, include: { tipo: true } });
  agregarHoja(
    wb,
    "Partida",
    ["codPartida", "nomPartida", "tipoId", "tipo", "rol del tipo", "exigeSaldoCero", "exposicionCambiante"],
    partidas.map((p) => ({
      codPartida: p.codPartida,
      nomPartida: p.nomPartida,
      tipoId: p.tipoId,
      tipo: p.tipo?.nomTipo ?? null,
      "rol del tipo": p.tipo?.rol ?? null,
      exigeSaldoCero: p.tipo?.exigeSaldoCero ?? null,
      exposicionCambiante: p.tipo?.exposicionCambiante ?? null,
    }))
  );

  const rubros = await prisma.rubro.findMany({
    orderBy: { codRubro: "asc" },
    include: {
      partidaPatrimonial: { select: { nomPartida: true } },
      nofPorUnidad: { where: { unidadNegocioId: codUnidad } },
      _count: { select: { planes: true } },
    },
  });
  agregarHoja(
    wb,
    "Rubro",
    ["codRubro", "nomRubro", "partidaPatrimonialId", "partida", "bucketNOF (default)", "orden", "CTO/ONP/ARS de esta unidad", "cantidad de cuentas"],
    rubros.map((r) => ({
      codRubro: r.codRubro,
      nomRubro: r.nomRubro,
      partidaPatrimonialId: r.partidaPatrimonialId,
      partida: r.partidaPatrimonial?.nomPartida ?? null,
      "bucketNOF (default)": r.bucketNOF ? `${r.bucketNOF} (${ABREV_NOF[r.bucketNOF]})` : null,
      orden: r.orden,
      "CTO/ONP/ARS de esta unidad": r.nofPorUnidad[0]
        ? (r.nofPorUnidad[0].bucketNOF ? ABREV_NOF[r.nofPorUnidad[0].bucketNOF] : "sin clasificar")
        : null,
      "cantidad de cuentas": r._count.planes,
    }))
  );

  const sub1 = await prisma.subrubro.findMany({ orderBy: { codSubrubro: "asc" }, include: { _count: { select: { planes: true } } } });
  agregarHoja(
    wb,
    "Subrubro",
    ["codSubrubro", "nomSubrubro", "campoResultado", "cantidad de cuentas"],
    sub1.map((s) => ({ codSubrubro: s.codSubrubro, nomSubrubro: s.nomSubrubro, campoResultado: s.campoResultado, "cantidad de cuentas": s._count.planes }))
  );
  const sub2 = await prisma.subrubro2.findMany({ orderBy: { codSubrubro2: "asc" }, include: { _count: { select: { planes: true } } } });
  agregarHoja(
    wb,
    "Subrubro 2",
    ["codSubrubro2", "nomSubrubro2", "cantidad de cuentas"],
    sub2.map((s) => ({ codSubrubro2: s.codSubrubro2, nomSubrubro2: s.nomSubrubro2, "cantidad de cuentas": s._count.planes }))
  );
  const sub3 = await prisma.subrubro3.findMany({ orderBy: { codSubrubro3: "asc" }, include: { _count: { select: { planes: true } } } });
  agregarHoja(
    wb,
    "Subrubro 3",
    ["codSubrubro3", "nomSubrubro3", "cantidad de cuentas"],
    sub3.map((s) => ({ codSubrubro3: s.codSubrubro3, nomSubrubro3: s.nomSubrubro3, "cantidad de cuentas": s._count.planes }))
  );

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function textoDeCelda(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined && v.result !== null) return String(v.result).trim();
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v) return String(v.text).trim();
    if (v instanceof Date) return v.toISOString();
    return "";
  }
  return String(v).trim();
}

// Lee el Excel de la carga masiva: la hoja "Carga masiva" si existe, si no la
// primera que tenga una columna "Cuenta". Los encabezados se reconocen por
// nombre (no por posición, sin importar mayúsculas ni acentos); las columnas
// que no son de la carga se ignoran.
export async function leerFilasCarga(
  contenido: ArrayBuffer
): Promise<{ filas: FilaCarga[] } | { error: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(contenido);
  } catch {
    return { error: "No se pudo leer el archivo. Tiene que ser un Excel (.xlsx)." };
  }

  const nombresDeColumna = (ws: ExcelJS.Worksheet) => {
    const mapa = new Map<string, number>();
    ws.getRow(1).eachCell((cell, col) => mapa.set(normalizarTexto(textoDeCelda(cell)), col));
    return mapa;
  };
  const ws =
    wb.worksheets.find((w) => normalizarTexto(w.name) === normalizarTexto(HOJA_CARGA)) ??
    wb.worksheets.find((w) => nombresDeColumna(w).has("cuenta"));
  if (!ws) {
    return { error: 'No se encontró la hoja "Carga masiva" (ni ninguna hoja con una columna "Cuenta").' };
  }

  const columnas = nombresDeColumna(ws);
  const colCuenta = columnas.get("cuenta");
  if (!colCuenta) return { error: 'La hoja no tiene la columna "Cuenta" en la primera fila.' };
  const col = (nombre: string) => columnas.get(normalizarTexto(nombre));
  const cEmpresa = col("Empresa");
  const cPartida = col("Partida");
  const cRubro = col("Rubro");
  const cSub1 = col("Subrubro");
  const cSub2 = col("Subrubro 2");
  const cSub3 = col("Subrubro 3");

  const filas: FilaCarga[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const leer = (c: number | undefined) => (c ? textoDeCelda(row.getCell(c)) : "");
    filas.push({
      fila: r,
      empresa: leer(cEmpresa),
      cuenta: leer(colCuenta),
      partida: leer(cPartida),
      rubro: leer(cRubro),
      subrubro: leer(cSub1),
      subrubro2: leer(cSub2),
      subrubro3: leer(cSub3),
    });
  }
  return { filas };
}
