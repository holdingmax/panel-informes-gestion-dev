"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function listPlanDeCuentas() {
  return prisma.planDeCuentas.findMany({
    include: {
      empresa: true,
      partidaPatrimonial: true,
      rubro: true,
      subrubro: true,
      subrubro2: true,
      subrubro3: true,
      categoriaOyA: true,
    },
    orderBy: { cuenta: "asc" },
  });
}

export async function createPlanDeCuentas(formData: FormData) {
  const cuenta = String(formData.get("cuenta") ?? "").trim();
  if (!cuenta) throw new Error("La cuenta es obligatoria");
  if (cuenta.length > 90) throw new Error("La cuenta no puede superar 90 caracteres");

  const empresaId = Number(formData.get("empresaId"));
  const partidaPatrimonialId = Number(formData.get("partidaPatrimonialId"));
  const rubroId = Number(formData.get("rubroId"));
  const subrubroId = Number(formData.get("subrubroId"));
  const subrubro2Id = Number(formData.get("subrubro2Id"));
  const subrubro3Id = Number(formData.get("subrubro3Id"));
  const categoriaOyAId = Number(formData.get("categoriaOyAId"));

  if (
    [empresaId, partidaPatrimonialId, rubroId, subrubroId, subrubro2Id, subrubro3Id, categoriaOyAId]
      .some((value) => !Number.isInteger(value))
  ) {
    throw new Error("Completá todos los desplegables");
  }

  await prisma.planDeCuentas.create({
    data: {
      cuenta,
      empresaId,
      partidaPatrimonialId,
      rubroId,
      subrubroId,
      subrubro2Id,
      subrubro3Id,
      categoriaOyAId,
    },
  });

  revalidatePath("/configuracion/plan-de-cuentas");
}
