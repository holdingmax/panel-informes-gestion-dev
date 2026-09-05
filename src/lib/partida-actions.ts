"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { TipoPartida } from "@/generated/prisma/enums";

export async function listPartidasConClasificacion() {
  return prisma.partidaPatrimonial.findMany({ orderBy: { nomPartida: "asc" } });
}

const VALID: TipoPartida[] = ["ACTIVO", "PASIVO_PATRIMONIO_NETO", "RESULTADO"];

export async function updatePartidaTipo(codPartida: number, value: string) {
  const tipo: TipoPartida | null = (VALID as string[]).includes(value)
    ? (value as TipoPartida)
    : null;
  await prisma.partidaPatrimonial.update({ where: { codPartida }, data: { tipo } });
  revalidatePath("/configuracion/partida-patrimonial");
}
