"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CategoriaOrigenAplicacion } from "@/generated/prisma/enums";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";

export async function listRubrosConClasificacion() {
  return prisma.rubro.findMany({ orderBy: { codRubro: "asc" } });
}

export async function updateRubroCategoriaOyA(codRubro: number, value: string) {
  const categoriaOyA: CategoriaOrigenAplicacion | null =
    value === "ORIGEN" || value === "APLICACION" || value === "AJUSTE" ? value : null;
  await prisma.rubro.update({ where: { codRubro }, data: { categoriaOyA } });
  revalidatePath("/configuracion/rubro");
}

export async function updateRubroNombre(codRubro: number, nomRubro: string) {
  const value = nomRubro.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.rubro.update({ where: { codRubro }, data: { nomRubro: value } });
  revalidatePath("/configuracion/rubro");
}

export async function checkDeleteRubro(codRubro: number): Promise<DeleteCheckResult> {
  const cantidad = await prisma.planDeCuentas.count({ where: { rubroId: codRubro } });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} cuenta(s) del Plan de Cuentas todavía lo usan. Reclasificalas primero en Configuración → Plan de Cuentas.`,
  };
}

export async function deleteRubro(codRubro: number) {
  const check = await checkDeleteRubro(codRubro);
  if (check.blocked) throw new Error(check.reason);

  await prisma.rubro.delete({ where: { codRubro } });
  revalidatePath("/configuracion/rubro");
}
