"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { RolTipoPartida } from "@/generated/prisma/enums";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

const ROLES_VALIDOS: RolTipoPartida[] = ["ACTIVO", "PASIVO", "PATRIMONIO_NETO", "RESULTADO"];

function parseRol(value: string): RolTipoPartida | null {
  return (ROLES_VALIDOS as string[]).includes(value) ? (value as RolTipoPartida) : null;
}

export async function listTiposPartida() {
  await requireUser();
  return prisma.tipoPartida.findMany({ orderBy: { codTipo: "asc" } });
}

export async function createTipoPartida(formData: FormData) {
  await requireAdmin();
  const nomTipo = String(formData.get("nomTipo") ?? "").trim();
  if (!nomTipo) throw new Error("El nombre es obligatorio");
  if (nomTipo.length > 40) throw new Error("El nombre no puede superar 40 caracteres");

  const rol = parseRol(String(formData.get("rol") ?? ""));
  const exigeSaldoCero = formData.get("exigeSaldoCero") === "on";
  const exposicionCambiante = formData.get("exposicionCambiante") === "on";

  await prisma.tipoPartida.create({ data: { nomTipo, rol, exigeSaldoCero, exposicionCambiante } });
  revalidatePath("/configuracion/tipo-partida");
  revalidatePath("/configuracion/partida-patrimonial");
}

export async function updateTipoPartidaNombre(codTipo: number, nomTipo: string) {
  await requireAdmin();
  const value = nomTipo.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 40) throw new Error("El nombre no puede superar 40 caracteres");

  await prisma.tipoPartida.update({ where: { codTipo }, data: { nomTipo: value } });
  revalidatePath("/configuracion/tipo-partida");
  revalidatePath("/configuracion/partida-patrimonial");
}

export async function updateTipoPartidaRol(codTipo: number, value: string) {
  await requireAdmin();
  const rol = parseRol(value);
  await prisma.tipoPartida.update({ where: { codTipo }, data: { rol } });
  revalidatePath("/configuracion/tipo-partida");
}

export async function updateTipoPartidaExigeSaldoCero(codTipo: number, exigeSaldoCero: boolean) {
  await requireAdmin();
  await prisma.tipoPartida.update({ where: { codTipo }, data: { exigeSaldoCero } });
  revalidatePath("/configuracion/tipo-partida");
}

export async function updateTipoPartidaExposicionCambiante(
  codTipo: number,
  exposicionCambiante: boolean
) {
  await requireAdmin();
  await prisma.tipoPartida.update({ where: { codTipo }, data: { exposicionCambiante } });
  revalidatePath("/configuracion/tipo-partida");
}

export async function checkDeleteTipoPartida(codTipo: number): Promise<DeleteCheckResult> {
  await requireUser();
  const cantidad = await prisma.partidaPatrimonial.count({ where: { tipoId: codTipo } });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} partida(s) patrimonial(es) todavía lo usan. Reclasificalas primero en Configuración → Partida Patrimonial.`,
  };
}

export async function deleteTipoPartida(codTipo: number) {
  await requireAdmin();
  const check = await checkDeleteTipoPartida(codTipo);
  if (check.blocked) throw new Error(check.reason);

  await prisma.tipoPartida.delete({ where: { codTipo } });
  revalidatePath("/configuracion/tipo-partida");
}
