"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CategoriaOrigenAplicacion, BucketNOF } from "@/generated/prisma/enums";

export async function listRubrosConClasificacion() {
  return prisma.rubro.findMany({ orderBy: { nomRubro: "asc" } });
}

export async function updateRubroCategoriaOyA(codRubro: number, value: string) {
  const categoriaOyA: CategoriaOrigenAplicacion | null =
    value === "ORIGEN" || value === "APLICACION" ? value : null;
  await prisma.rubro.update({ where: { codRubro }, data: { categoriaOyA } });
  revalidatePath("/configuracion/rubro");
}

export async function updateRubroBucketNOF(codRubro: number, value: string) {
  const bucketNOF: BucketNOF | null =
    value === "OPERATIVO" || value === "NO_OPERATIVO" || value === "FINANCIAMIENTO"
      ? value
      : null;
  await prisma.rubro.update({ where: { codRubro }, data: { bucketNOF } });
  revalidatePath("/configuracion/rubro");
}
