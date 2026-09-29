"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

export async function listMonedas() {
  await requireUser();
  return prisma.moneda.findMany({ orderBy: { codMoneda: "asc" } });
}

export async function createMoneda(formData: FormData) {
  await requireAdmin();
  const nomMoneda = String(formData.get("nomMoneda") ?? "").trim();
  const simbolo = String(formData.get("simbolo") ?? "").trim();

  if (!nomMoneda) throw new Error("El nombre es obligatorio");
  if (nomMoneda.length > 60) throw new Error("El nombre no puede superar 60 caracteres");
  if (!simbolo) throw new Error("El símbolo es obligatorio");
  if (simbolo.length > 5) throw new Error("El símbolo no puede superar 5 caracteres");

  await prisma.moneda.create({ data: { nomMoneda, simbolo } });

  revalidatePath("/configuracion/monedas");
}

export async function updateMoneda(codMoneda: number, nomMoneda: string, simbolo: string) {
  await requireAdmin();
  const nombre = nomMoneda.trim();
  const simb = simbolo.trim();

  if (!nombre) throw new Error("El nombre es obligatorio");
  if (nombre.length > 60) throw new Error("El nombre no puede superar 60 caracteres");
  if (!simb) throw new Error("El símbolo es obligatorio");
  if (simb.length > 5) throw new Error("El símbolo no puede superar 5 caracteres");

  await prisma.moneda.update({
    where: { codMoneda },
    data: { nomMoneda: nombre, simbolo: simb },
  });

  revalidatePath("/configuracion/monedas");
}

export async function checkDeleteMoneda(codMoneda: number): Promise<DeleteCheckResult> {
  await requireUser();
  const cantidad = await prisma.empresa.count({
    where: {
      OR: [
        { monedaPrimariaId: codMoneda },
        { monedaSecundariaId: codMoneda },
        { monedaActualizaId: codMoneda },
      ],
    },
  });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} empresa(s) la usan como moneda primaria, secundaria o de actualización.`,
  };
}

export async function deleteMoneda(codMoneda: number) {
  await requireAdmin();
  const check = await checkDeleteMoneda(codMoneda);
  if (check.blocked) throw new Error(check.reason);

  await prisma.moneda.delete({ where: { codMoneda } });

  revalidatePath("/configuracion/monedas");
}
