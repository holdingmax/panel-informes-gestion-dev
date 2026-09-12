"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function listSeriesEIndices() {
  return prisma.seriesEIndices.findMany({ orderBy: { periodo: "asc" } });
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

  const ultimo = await prisma.seriesEIndices.findFirst({ orderBy: { periodo: "desc" } });

  if (ultimo) {
    const esperado = addMonthsUTC(ultimo.periodo, 1);
    if (periodo.getTime() !== esperado.getTime()) {
      const esperadoLabel = `${String(esperado.getUTCMonth() + 1).padStart(2, "0")}-${esperado.getUTCFullYear()}`;
      return {
        error: `La serie tiene que ser correlativa: el próximo período a cargar es ${esperadoLabel}.`,
      };
    }
  }

  await prisma.seriesEIndices.create({ data: { periodo, indice, dolar } });
  revalidatePath("/configuracion/series-e-indices");
  return { success: true as const };
}

// Devuelve el período (si existe) donde la serie tiene un hueco antes de
// llegar a `hasta`, o null si está completa desde el primer período cargado.
export async function verificarSeriesCompletaHasta(hasta: Date): Promise<string | null> {
  const todos = await prisma.seriesEIndices.findMany({ orderBy: { periodo: "asc" } });
  if (todos.length === 0) {
    return "Todavía no se cargó ningún período en Series e Índices.";
  }

  const primero = todos[0].periodo;
  if (hasta.getTime() < primero.getTime()) {
    return null; // el período pedido es anterior a que exista la serie: no aplica
  }

  let esperado = primero;
  for (const fila of todos) {
    if (fila.periodo.getTime() !== esperado.getTime()) {
      const label = `${String(esperado.getUTCMonth() + 1).padStart(2, "0")}-${esperado.getUTCFullYear()}`;
      return `Falta el período ${label} en Series e Índices.`;
    }
    if (esperado.getTime() >= hasta.getTime()) return null;
    esperado = addMonthsUTC(esperado, 1);
  }

  const label = `${String(esperado.getUTCMonth() + 1).padStart(2, "0")}-${esperado.getUTCFullYear()}`;
  return `Series e Índices todavía no está cargada hasta ${label}.`;
}
