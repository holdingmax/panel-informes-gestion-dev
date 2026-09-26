"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { TipoPartida } from "@/generated/prisma/enums";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";

export async function listPartidasConClasificacion() {
  return prisma.partidaPatrimonial.findMany({ orderBy: { codPartida: "asc" } });
}

const VALID: TipoPartida[] = ["ACTIVO", "PASIVO", "PATRIMONIO_NETO", "RESULTADO"];

export async function updatePartidaTipo(codPartida: number, value: string) {
  const tipo: TipoPartida | null = (VALID as string[]).includes(value)
    ? (value as TipoPartida)
    : null;
  await prisma.partidaPatrimonial.update({ where: { codPartida }, data: { tipo } });
  revalidatePath("/configuracion/partida-patrimonial");
}

export async function updatePartidaNombre(codPartida: number, nomPartida: string) {
  const value = nomPartida.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 40) throw new Error("El nombre no puede superar 40 caracteres");

  await prisma.partidaPatrimonial.update({ where: { codPartida }, data: { nomPartida: value } });
  revalidatePath("/configuracion/partida-patrimonial");
}

export async function checkDeletePartida(codPartida: number): Promise<DeleteCheckResult> {
  const cantidad = await prisma.planDeCuentas.count({ where: { partidaPatrimonialId: codPartida } });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} cuenta(s) del Plan de Cuentas todavía la usan. Reclasificalas primero en Configuración → Plan de Cuentas.`,
  };
}

export async function deletePartida(codPartida: number) {
  const check = await checkDeletePartida(codPartida);
  if (check.blocked) throw new Error(check.reason);

  await prisma.partidaPatrimonial.delete({ where: { codPartida } });
  revalidatePath("/configuracion/partida-patrimonial");
}
