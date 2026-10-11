"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

export async function listSeriesEIndicesTablas() {
  await requireUser();
  const tablas = await prisma.seriesEIndicesTabla.findMany({
    orderBy: { codTabla: "asc" },
    include: {
      _count: { select: { filas: true, unidades: true } },
    },
  });
  return tablas;
}

export async function getSeriesEIndicesTabla(codTabla: number) {
  await requireUser();
  return prisma.seriesEIndicesTabla.findUnique({ where: { codTabla } });
}

export async function createSeriesEIndicesTabla(formData: FormData) {
  await requireAdmin();
  const tipoTabla = String(formData.get("tipoTabla") ?? "").trim();
  if (!tipoTabla) throw new Error("El tipo de tabla es obligatorio");
  if (tipoTabla.length > 60) throw new Error("El tipo de tabla no puede superar 60 caracteres");

  await prisma.seriesEIndicesTabla.create({ data: { tipoTabla } });
  revalidatePath("/configuracion/series-e-indices");
}

export async function updateSeriesEIndicesTabla(codTabla: number, tipoTabla: string) {
  await requireAdmin();
  const value = tipoTabla.trim();
  if (!value) throw new Error("El tipo de tabla es obligatorio");
  if (value.length > 60) throw new Error("El tipo de tabla no puede superar 60 caracteres");

  await prisma.seriesEIndicesTabla.update({ where: { codTabla }, data: { tipoTabla: value } });
  revalidatePath("/configuracion/series-e-indices");
}

export async function checkDeleteSeriesEIndicesTabla(codTabla: number): Promise<DeleteCheckResult> {
  await requireUser();
  const unidades = await prisma.unidadNegocio.findMany({
    where: { seriesTablaId: codTabla },
    select: { nombreUnidad: true },
  });
  if (unidades.length === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: está vinculada a ${unidades.length} unidad(es) de negocio (${unidades.map((u) => u.nombreUnidad).join(", ")}). Desvinculalas primero.`,
  };
}

export async function deleteSeriesEIndicesTabla(codTabla: number) {
  await requireAdmin();
  const check = await checkDeleteSeriesEIndicesTabla(codTabla);
  if (check.blocked) throw new Error(check.reason);

  await prisma.seriesEIndicesTabla.delete({ where: { codTabla } });
  revalidatePath("/configuracion/series-e-indices");
}

// Reemplazo total del conjunto de Unidades de Negocio que usan esta tabla —
// mismo patrón que actualizarEmpresasVinculadas en unidad-negocio-actions.ts.
// Una unidad solo puede usar una tabla a la vez: si ya estaba vinculada a
// otra, queda reasignada a esta.
export async function vincularUnidadesATabla(formData: FormData) {
  await requireAdmin();
  const codTabla = Number(formData.get("codTabla"));
  const unidadIds = formData.getAll("unidadIds").map(Number).filter(Number.isFinite);

  await prisma.$transaction([
    prisma.unidadNegocio.updateMany({
      where: { seriesTablaId: codTabla, codUnidad: { notIn: unidadIds } },
      data: { seriesTablaId: null },
    }),
    prisma.unidadNegocio.updateMany({
      where: { codUnidad: { in: unidadIds } },
      data: { seriesTablaId: codTabla },
    }),
  ]);

  revalidatePath("/configuracion/series-e-indices");
}

export async function listUnidadesConSeriesTabla() {
  await requireUser();
  return prisma.unidadNegocio.findMany({
    orderBy: { codUnidad: "asc" },
    select: { codUnidad: true, nombreUnidad: true, seriesTablaId: true },
  });
}

export async function listSeriesEIndices(tablaId: number) {
  await requireUser();
  return prisma.seriesEIndices.findMany({ where: { tablaId }, orderBy: { periodo: "asc" } });
}

function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function parsePeriodoMM_AAAA(value: string): Date | null {
  const match = /^(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const mes = Number(match[1]);
  const anio = Number(match[2]);
  if (mes < 1 || mes > 12) return null;
  return new Date(Date.UTC(anio, mes - 1, 1));
}

// Índice solo hace falta si alguna Empresa que usa la tabla ajusta por
// inflación; Dólar solo si alguna tiene Moneda secundaria configurada (ver
// comentario en el modelo, schema.prisma). Lo que nunca se admite es una
// mezcla: algunos períodos con el campo cargado y otros sin él — o está
// completo en TODOS los períodos de la tabla, o vacío en todos. Se valida
// contra el resto de la tabla (excluyendo la fila que se está por crear o
// editar) cada vez que se toca un valor.
type EstadoColumna = "sin-datos" | "completo" | "vacio" | "mixto";

function estadoDeColumna(valores: (number | null)[]): EstadoColumna {
  if (valores.length === 0) return "sin-datos";
  const conValor = valores.filter((v) => v !== null).length;
  if (conValor === valores.length) return "completo";
  if (conValor === 0) return "vacio";
  return "mixto";
}

function errorDeConsistencia(campoLabel: string, usoLabel: string, estadoResto: EstadoColumna, nuevoEsNulo: boolean): string | null {
  // "mixto" ya es un estado roto previo (no debería poder llegar a darse si
  // esta regla se respetó desde el principio) — no se agrava más, se deja
  // pasar para no bloquear a quien venga a arreglarlo a mano.
  if (estadoResto === "sin-datos" || estadoResto === "mixto") return null;
  if (estadoResto === "completo" && nuevoEsNulo) {
    return `Todos los demás períodos de esta tabla ya tienen ${campoLabel} cargado — no se puede dejar vacío acá sin perder la continuidad de la serie. Completalo, o si ${usoLabel} ya no corresponde en esta tabla, vaciá también los demás períodos.`;
  }
  if (estadoResto === "vacio" && !nuevoEsNulo) {
    return `Ningún otro período de esta tabla tiene ${campoLabel} cargado — si vas a empezar a usarlo, cargalo desde el primer período de la serie, no a mitad de camino.`;
  }
  return null;
}

// Convierte un valor crudo de formulario/Excel a number|null: vacío ("", null,
// undefined) es válido (campo no usado en esta tabla); si viene algo, tiene
// que ser un número mayor a cero.
function parseOpcionalPositivo(raw: FormDataEntryValue | unknown): { ok: true; valor: number | null } | { ok: false } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, valor: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { ok: false };
  return { ok: true, valor: n };
}

export async function createSeriesEIndices(formData: FormData) {
  await requireAdmin();
  const tablaId = Number(formData.get("tablaId"));
  const periodoRaw = String(formData.get("periodo") ?? "");

  const periodo = parsePeriodoMM_AAAA(periodoRaw);
  if (!periodo) {
    return { error: 'Período inválido. Usá el formato MM-AAAA (ej. "06-2026").' };
  }

  const indiceParsed = parseOpcionalPositivo(formData.get("indice"));
  if (!indiceParsed.ok) return { error: "Índice inválido — dejalo vacío o cargá un número mayor a cero." };
  const dolarParsed = parseOpcionalPositivo(formData.get("dolar"));
  if (!dolarParsed.ok) return { error: "Dólar inválido — dejalo vacío o cargá un número mayor a cero." };
  const indice = indiceParsed.valor;
  const dolar = dolarParsed.valor;

  const resto = await prisma.seriesEIndices.findMany({ where: { tablaId }, select: { indice: true, dolar: true } });
  const errIndice = errorDeConsistencia(
    "Índice",
    "el ajuste por inflación",
    estadoDeColumna(resto.map((r) => (r.indice !== null ? Number(r.indice) : null))),
    indice === null
  );
  if (errIndice) return { error: errIndice };
  const errDolar = errorDeConsistencia(
    "Dólar",
    "la conversión a moneda secundaria",
    estadoDeColumna(resto.map((r) => (r.dolar !== null ? Number(r.dolar) : null))),
    dolar === null
  );
  if (errDolar) return { error: errDolar };

  const ultimo = await prisma.seriesEIndices.findFirst({
    where: { tablaId },
    orderBy: { periodo: "desc" },
  });

  if (ultimo) {
    const esperado = addMonthsUTC(ultimo.periodo, 1);
    if (periodo.getTime() !== esperado.getTime()) {
      const esperadoLabel = `${String(esperado.getUTCMonth() + 1).padStart(2, "0")}-${esperado.getUTCFullYear()}`;
      return {
        error: `La serie tiene que ser correlativa: el próximo período a cargar es ${esperadoLabel}.`,
      };
    }
  }

  await prisma.seriesEIndices.create({ data: { tablaId, periodo, indice, dolar } });
  revalidatePath(`/configuracion/series-e-indices/${tablaId}`);
  return { success: true as const };
}

// Corregir índice/dólar de un período ya cargado no rompe la correlatividad
// (el período en sí no cambia) — a diferencia de borrar, se permite en
// cualquier fila, no solo en la última. `indice`/`dolar` en null borra el
// valor de esa fila — sujeto a la misma regla de consistencia que el alta.
export async function updateSeriesEIndicesValores(id: string, indice: number | null, dolar: number | null) {
  await requireAdmin();
  if (indice !== null && (!Number.isFinite(indice) || indice <= 0)) throw new Error("Índice inválido.");
  if (dolar !== null && (!Number.isFinite(dolar) || dolar <= 0)) throw new Error("Dólar inválido.");

  const actual = await prisma.seriesEIndices.findUniqueOrThrow({ where: { id } });
  const resto = await prisma.seriesEIndices.findMany({
    where: { tablaId: actual.tablaId, id: { not: id } },
    select: { indice: true, dolar: true },
  });
  const errIndice = errorDeConsistencia(
    "Índice",
    "el ajuste por inflación",
    estadoDeColumna(resto.map((r) => (r.indice !== null ? Number(r.indice) : null))),
    indice === null
  );
  if (errIndice) throw new Error(errIndice);
  const errDolar = errorDeConsistencia(
    "Dólar",
    "la conversión a moneda secundaria",
    estadoDeColumna(resto.map((r) => (r.dolar !== null ? Number(r.dolar) : null))),
    dolar === null
  );
  if (errDolar) throw new Error(errDolar);

  const fila = await prisma.seriesEIndices.update({ where: { id }, data: { indice, dolar } });
  revalidatePath(`/configuracion/series-e-indices/${fila.tablaId}`);
}

// Solo se puede borrar la última fila cargada de la tabla: si se permitiera
// borrar una del medio, la próxima alta (que exige correlatividad contra la
// última) quedaría con un hueco silencioso en la serie.
export async function checkDeleteSeriesEIndices(id: string): Promise<DeleteCheckResult> {
  await requireUser();
  const fila = await prisma.seriesEIndices.findUniqueOrThrow({ where: { id } });
  const ultimo = await prisma.seriesEIndices.findFirst({
    where: { tablaId: fila.tablaId },
    orderBy: { periodo: "desc" },
  });
  if (ultimo?.id === id) return { blocked: false };
  return {
    blocked: true,
    reason:
      "Solo se puede eliminar el último período cargado de esta tabla — borrar uno del medio dejaría un hueco en la serie mensual.",
  };
}

export async function deleteSeriesEIndices(id: string) {
  await requireAdmin();
  const check = await checkDeleteSeriesEIndices(id);
  if (check.blocked) throw new Error(check.reason);

  const fila = await prisma.seriesEIndices.delete({ where: { id } });
  revalidatePath(`/configuracion/series-e-indices/${fila.tablaId}`);
}

// Devuelve el período (si existe) donde la serie tiene un hueco antes de
// llegar a `hasta`, o null si está completa desde el primer período cargado.
// `requiere` dice qué campos tienen que tener valor en cada período — por
// ejemplo, si alguna Empresa de la unidad tiene "Actualiza" en Sí pero el
// período correspondiente tiene el Índice vacío, eso también es "incompleta"
// aunque la fila del período exista (ver bsys-import.ts).
export async function verificarSeriesCompletaHasta(
  tablaId: number | null,
  hasta: Date,
  requiere: { indice: boolean; dolar: boolean }
): Promise<string | null> {
  await requireUser();
  if (!tablaId) {
    return "Esta unidad de negocio no tiene una tabla de Series e Índices vinculada.";
  }

  const todos = await prisma.seriesEIndices.findMany({
    where: { tablaId },
    orderBy: { periodo: "asc" },
  });
  if (todos.length === 0) {
    return "Todavía no se cargó ningún período en la tabla de Series e Índices de esta unidad.";
  }

  const primero = todos[0].periodo;
  if (hasta.getTime() < primero.getTime()) {
    return null; // el período pedido es anterior a que exista la serie: no aplica
  }

  let esperado = primero;
  for (const fila of todos) {
    if (fila.periodo.getTime() !== esperado.getTime()) {
      return `Falta el período ${periodoLabel(esperado)} en la tabla de Series e Índices de esta unidad.`;
    }
    if (requiere.indice && fila.indice === null) {
      return `Falta el Índice del período ${periodoLabel(esperado)} en la tabla de Series e Índices de esta unidad (hay Empresas con "Actualiza" en Sí que lo necesitan para el ajuste por inflación).`;
    }
    if (requiere.dolar && fila.dolar === null) {
      return `Falta el Dólar del período ${periodoLabel(esperado)} en la tabla de Series e Índices de esta unidad (hay Empresas con Moneda secundaria configurada que lo necesitan para la conversión).`;
    }
    if (esperado.getTime() >= hasta.getTime()) return null;
    esperado = addMonthsUTC(esperado, 1);
  }

  return `La tabla de Series e Índices de esta unidad todavía no está cargada hasta ${periodoLabel(esperado)}.`;
}

function periodoLabel(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v !== null && typeof v === "object" && "result" in v) return v.result;
  return v;
}

function normalizeEtiqueta(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// A diferencia del período de resultados-historicos-actions.ts (que acepta
// cualquier fecha reconocible por el motor de JS), acá se es más estricto:
// o es una celda de fecha de Excel, o es texto en el mismo formato MM-AAAA
// que usa el formulario de carga manual de arriba — así el mensaje de error
// le puede decir al operador exactamente qué formato usar.
function toPeriodoCelda(value: unknown): Date | null {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }
  if (typeof value === "string") return parsePeriodoMM_AAAA(value);
  return null;
}

type ImportarSeriesResultado = { creados: number } | { error: string };

// Carga masiva por Excel — a diferencia de importarResultadosHistoricosExcel
// (que omite en silencio los períodos que ya existen y sigue con el resto),
// acá se valida el archivo COMPLETO antes de crear nada: la tabla exige una
// serie mensual correlativa y sin huecos (ver createSeriesEIndices/
// checkDeleteSeriesEIndices), así que una fila fuera de secuencia, duplicada
// o con un hueco tiene que rechazar todo el archivo con un mensaje puntual
// (qué fila, qué se esperaba) para que el operador lo corrija y reintente —
// nunca dejar una carga parcial que generaría un hueco silencioso.
export async function importarSeriesEIndicesExcel(formData: FormData): Promise<ImportarSeriesResultado> {
  await requireAdmin();
  const tablaId = Number(formData.get("tablaId"));
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Seleccioná un archivo Excel." };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await archivo.arrayBuffer());
  const sheet = wb.worksheets[0];
  if (!sheet) return { error: "El archivo no tiene hojas." };

  const filaEncabezados = sheet.getRow(1);
  let colPeriodo: number | null = null;
  let colIndice: number | null = null;
  let colDolar: number | null = null;
  for (let c = 1; c <= sheet.columnCount; c++) {
    const etiqueta = normalizeEtiqueta(String(cellValue(filaEncabezados.getCell(c)) ?? ""));
    if (etiqueta === "periodo" || etiqueta === "mes") colPeriodo = c;
    else if (etiqueta === "indice") colIndice = c;
    else if (etiqueta === "dolar" || etiqueta === "usd") colDolar = c;
  }
  // Período es el único campo realmente obligatorio — Índice y Dólar son
  // opcionales (ver comentario en el modelo), así que si el archivo ni
  // siquiera trae esa columna, se la trata como "vacía en todas las filas".
  if (!colPeriodo) {
    return {
      error: 'No se reconoció en la fila 1 la columna de Período. Tiene que llamarse exactamente "Período".',
    };
  }

  function celdaVacia(v: unknown) {
    return v === null || v === undefined || v === "";
  }

  type FilaParseada = { fila: number; periodo: Date; indice: number | null; dolar: number | null };
  const filas: FilaParseada[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const periodoRaw = cellValue(row.getCell(colPeriodo));
    const indiceRaw = colIndice ? cellValue(row.getCell(colIndice)) : null;
    const dolarRaw = colDolar ? cellValue(row.getCell(colDolar)) : null;

    if (celdaVacia(periodoRaw)) {
      if (celdaVacia(indiceRaw) && celdaVacia(dolarRaw)) continue; // fila en blanco — se ignora
      return {
        error: `Fila ${r} del Excel: falta el Período — es el único campo obligatorio en cada fila.`,
      };
    }

    const periodo = toPeriodoCelda(periodoRaw);
    if (!periodo) {
      return {
        error: `Fila ${r} del Excel: no se pudo interpretar el período "${String(periodoRaw ?? "")}". Usá el formato MM-AAAA (ej. "06-2026") o una celda con una fecha real.`,
      };
    }

    let indice: number | null = null;
    if (!celdaVacia(indiceRaw)) {
      indice = Number(indiceRaw);
      if (!Number.isFinite(indice) || indice <= 0) {
        return {
          error: `Fila ${r} del Excel (período ${periodoLabel(periodo)}): el Índice tiene que ser un número mayor a cero, o dejarse vacío.`,
        };
      }
    }
    let dolar: number | null = null;
    if (!celdaVacia(dolarRaw)) {
      dolar = Number(dolarRaw);
      if (!Number.isFinite(dolar) || dolar <= 0) {
        return {
          error: `Fila ${r} del Excel (período ${periodoLabel(periodo)}): el Dólar tiene que ser un número mayor a cero, o dejarse vacío.`,
        };
      }
    }
    filas.push({ fila: r, periodo, indice, dolar });
  }

  if (filas.length === 0) {
    return { error: "No se encontró ninguna fila con datos para cargar debajo del encabezado." };
  }

  filas.sort((a, b) => a.periodo.getTime() - b.periodo.getTime());
  for (let i = 1; i < filas.length; i++) {
    if (filas[i].periodo.getTime() === filas[i - 1].periodo.getTime()) {
      return {
        error: `El archivo tiene el período ${periodoLabel(filas[i].periodo)} repetido (filas ${filas[i - 1].fila} y ${filas[i].fila}).`,
      };
    }
  }

  const ultimo = await prisma.seriesEIndices.findFirst({ where: { tablaId }, orderBy: { periodo: "desc" } });
  let esperado = ultimo ? addMonthsUTC(ultimo.periodo, 1) : filas[0].periodo;
  for (const f of filas) {
    if (f.periodo.getTime() !== esperado.getTime()) {
      return {
        error: `Fila ${f.fila} del Excel: la serie tiene que ser correlativa y sin huecos — el período esperado acá es ${periodoLabel(esperado)}, pero el archivo trae ${periodoLabel(f.periodo)}. Ajustá el orden/los períodos y volvé a intentar.`,
      };
    }
    esperado = addMonthsUTC(esperado, 1);
  }

  // Índice y Dólar tienen que quedar completos en TODOS los períodos de la
  // tabla o vacíos en todos — nunca mezclados — contando lo que ya existe
  // más lo que trae este archivo.
  const existentes = await prisma.seriesEIndices.findMany({ where: { tablaId }, select: { indice: true, dolar: true } });
  const estadoIndice = estadoDeColumna([
    ...existentes.map((e) => (e.indice !== null ? Number(e.indice) : null)),
    ...filas.map((f) => f.indice),
  ]);
  if (estadoIndice === "mixto") {
    return {
      error:
        "El archivo deja la columna Índice con algunos períodos cargados y otros vacíos (sumando lo que ya existe en la tabla con lo que trae este archivo) — completá Índice en todas las filas, o dejalo vacío en todas, y volvé a intentar.",
    };
  }
  const estadoDolar = estadoDeColumna([
    ...existentes.map((e) => (e.dolar !== null ? Number(e.dolar) : null)),
    ...filas.map((f) => f.dolar),
  ]);
  if (estadoDolar === "mixto") {
    return {
      error:
        "El archivo deja la columna Dólar con algunos períodos cargados y otros vacíos (sumando lo que ya existe en la tabla con lo que trae este archivo) — completá Dólar en todas las filas, o dejalo vacío en todas, y volvé a intentar.",
    };
  }

  // createMany en vez de $transaction(filas.map(create)): una sola sentencia
  // SQL (sigue siendo atómica — si falla una fila, falla todo el insert) en
  // vez de N round-trips a la base contra la que corre esto (hosteada, no
  // local) — con un archivo grande, N creates secuenciales dentro de un
  // $transaction superaban el timeout default de 5s de Prisma.
  await prisma.seriesEIndices.createMany({
    data: filas.map((f) => ({ tablaId, periodo: f.periodo, indice: f.indice, dolar: f.dolar })),
  });

  revalidatePath(`/configuracion/series-e-indices/${tablaId}`);
  return { creados: filas.length };
}
