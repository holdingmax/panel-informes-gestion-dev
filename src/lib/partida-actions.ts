"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

export async function listPartidasConClasificacion() {
  await requireUser();
  return prisma.partidaPatrimonial.findMany({
    orderBy: { codPartida: "asc" },
    include: { tipo: true },
  });
}

export async function updatePartidaTipoId(codPartida: number, value: string) {
  await requireAdmin();
  const tipoId = value ? Number(value) : null;
  await prisma.partidaPatrimonial.update({
    where: { codPartida },
    data: { tipoId: tipoId && Number.isInteger(tipoId) ? tipoId : null },
  });
  revalidatePath("/configuracion/partida-patrimonial");
}

export async function updatePartidaNombre(codPartida: number, nomPartida: string) {
  await requireAdmin();
  const value = nomPartida.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 40) throw new Error("El nombre no puede superar 40 caracteres");

  await prisma.partidaPatrimonial.update({ where: { codPartida }, data: { nomPartida: value } });
  revalidatePath("/configuracion/partida-patrimonial");
}

export async function checkDeletePartida(codPartida: number): Promise<DeleteCheckResult> {
  await requireUser();
  const cantidad = await prisma.planDeCuentas.count({ where: { partidaPatrimonialId: codPartida } });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} cuenta(s) del Plan de Cuentas todavía la usan. Reclasificalas primero en Configuración → Plan de Cuentas.`,
  };
}

export async function deletePartida(codPartida: number) {
  await requireAdmin();
  const check = await checkDeletePartida(codPartida);
  if (check.blocked) throw new Error(check.reason);

  await prisma.partidaPatrimonial.delete({ where: { codPartida } });
  revalidatePath("/configuracion/partida-patrimonial");
}
