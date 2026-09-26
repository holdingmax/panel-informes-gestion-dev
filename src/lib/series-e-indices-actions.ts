"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";

export async function listSeriesEIndicesTablas() {
  const tablas = await prisma.seriesEIndicesTabla.findMany({
    orderBy: { codTabla: "asc" },
    include: {
      _count: { select: { filas: true, unidades: true } },
    },
  });
  return tablas;
}

export async function getSeriesEIndicesTabla(codTabla: number) {
  return prisma.seriesEIndicesTabla.findUnique({ where: { codTabla } });
}

export async function createSeriesEIndicesTabla(formData: FormData) {
  const tipoTabla = String(formData.get("tipoTabla") ?? "").trim();
  if (!tipoTabla) throw new Error("El tipo de tabla es obligatorio");
  if (tipoTabla.length > 60) throw new Error("El tipo de tabla no puede superar 60 caracteres");

  await prisma.seriesEIndicesTabla.create({ data: { tipoTabla } });
  revalidatePath("/configuracion/series-e-indices");
}

export async function updateSeriesEIndicesTabla(codTabla: number, tipoTabla: string) {
  const value = tipoTabla.trim();
  if (!value) throw new Error("El tipo de tabla es obligatorio");
  if (value.length > 60) throw new Error("El tipo de tabla no puede superar 60 caracteres");

  await prisma.seriesEIndicesTabla.update({ where: { codTabla }, data: { tipoTabla: value } });
  revalidatePath("/configuracion/series-e-indices");
}

export async function checkDeleteSeriesEIndicesTabla(codTabla: number): Promise<DeleteCheckResult> {
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
  return prisma.unidadNegocio.findMany({
    orderBy: { codUnidad: "asc" },
    select: { codUnidad: true, nombreUnidad: true, seriesTablaId: true },
  });
}

export async function listSeriesEIndices(tablaId: number) {
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

export async function createSeriesEIndices(formData: FormData) {
  const tablaId = Number(formData.get("tablaId"));
  const periodoRaw = String(formData.get("periodo") ?? "");
  const indiceRaw = formData.get("indice");
  const dolarRaw = formData.get("dolar");

  const periodo = parsePeriodoMM_AAAA(periodoRaw);
  if (!periodo) {
    return { error: 'Período inválido. Usá el formato MM-AAAA (ej. "06-2026").' };
  }

  const indice = Number(indiceRaw);
  const dolar = Number(dolarRaw);
  if (!Number.isFinite(indice) || indice <= 0) return { error: "Índice inválido." };
  if (!Number.isFinite(dolar) || dolar <= 0) return { error: "Dólar inválido." };

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
// cualquier fila, no solo en la última.
export async function updateSeriesEIndicesValores(id: string, indice: number, dolar: number) {
  if (!Number.isFinite(indice) || indice <= 0) throw new Error("Índice inválido.");
  if (!Number.isFinite(dolar) || dolar <= 0) throw new Error("Dólar inválido.");

  const fila = await prisma.seriesEIndices.update({ where: { id }, data: { indice, dolar } });
  revalidatePath(`/configuracion/series-e-indices/${fila.tablaId}`);
}

// Solo se puede borrar la última fila cargada de la tabla: si se permitiera
// borrar una del medio, la próxima alta (que exige correlatividad contra la
// última) quedaría con un hueco silencioso en la serie.
export async function checkDeleteSeriesEIndices(id: string): Promise<DeleteCheckResult> {
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
  const check = await checkDeleteSeriesEIndices(id);
  if (check.blocked) throw new Error(check.reason);

  const fila = await prisma.seriesEIndices.delete({ where: { id } });
  revalidatePath(`/configuracion/series-e-indices/${fila.tablaId}`);
}

// Devuelve el período (si existe) donde la serie tiene un hueco antes de
// llegar a `hasta`, o null si está completa desde el primer período cargado.
export async function verificarSeriesCompletaHasta(
  tablaId: number | null,
  hasta: Date
): Promise<string | null> {
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
      const label = `${String(esperado.getUTCMonth() + 1).padStart(2, "0")}-${esperado.getUTCFullYear()}`;
      return `Falta el período ${label} en la tabla de Series e Índices de esta unidad.`;
    }
    if (esperado.getTime() >= hasta.getTime()) return null;
    esperado = addMonthsUTC(esperado, 1);
  }

  const label = `${String(esperado.getUTCMonth() + 1).padStart(2, "0")}-${esperado.getUTCFullYear()}`;
  return `La tabla de Series e Índices de esta unidad todavía no está cargada hasta ${label}.`;
}
