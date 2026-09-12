"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { BucketNOF } from "@/generated/prisma/enums";

export async function listCategoriasOyAConClasificacion() {
  return prisma.categoriaOyA.findMany({ orderBy: { nomOyA: "asc" } });
}

export async function updateCategoriaOyABucketNOF(codOyA: number, value: string) {
  const bucketNOF: BucketNOF | null =
    value === "OPERATIVO" || value === "NO_OPERATIVO" || value === "FINANCIAMIENTO"
      ? value
      : null;
  await prisma.categoriaOyA.update({ where: { codOyA }, data: { bucketNOF } });
  revalidatePath("/configuracion/categoria-oya");
}
