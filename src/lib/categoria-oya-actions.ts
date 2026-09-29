"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { BucketNOF } from "@/generated/prisma/enums";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

export async function listCategoriasOyAConClasificacion() {
  await requireUser();
  return prisma.categoriaOyA.findMany({ orderBy: { codOyA: "asc" } });
}

export async function updateCategoriaOyABucketNOF(codOyA: number, value: string) {
  await requireAdmin();
  const bucketNOF: BucketNOF | null =
    value === "OPERATIVO" || value === "NO_OPERATIVO" || value === "FINANCIAMIENTO"
      ? value
      : null;
  await prisma.categoriaOyA.update({ where: { codOyA }, data: { bucketNOF } });
  revalidatePath("/configuracion/categoria-oya");
}

export async function updateCategoriaOyANombre(codOyA: number, nomOyA: string) {
  await requireAdmin();
  const value = nomOyA.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.categoriaOyA.update({ where: { codOyA }, data: { nomOyA: value } });
  revalidatePath("/configuracion/categoria-oya");
}

export async function checkDeleteCategoriaOyA(codOyA: number): Promise<DeleteCheckResult> {
  await requireUser();
  const cantidad = await prisma.planDeCuentas.count({ where: { categoriaOyAId: codOyA } });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} cuenta(s) del Plan de Cuentas todavía la usan. Reclasificalas primero en Configuración → Plan de Cuentas.`,
  };
}

export async function deleteCategoriaOyA(codOyA: number) {
  await requireAdmin();
  const check = await checkDeleteCategoriaOyA(codOyA);
  if (check.blocked) throw new Error(check.reason);

  await prisma.categoriaOyA.delete({ where: { codOyA } });
  revalidatePath("/configuracion/categoria-oya");
}
