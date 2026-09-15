"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function listPlanDeCuentas() {
  return prisma.planDeCuentas.findMany({
    include: {
      empresa: { include: { unidadNegocio: true } },
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

  if ([empresaId, partidaPatrimonialId, rubroId, subrubroId].some((value) => !Number.isInteger(value))) {
    throw new Error("Completá Empresa, Cuenta, Partida, Rubro y Subrubro");
  }

  const optionalId = (field: string) => {
    const raw = String(formData.get(field) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) ? value : null;
  };

  const subrubro2Id = optionalId("subrubro2Id");
  const subrubro3Id = optionalId("subrubro3Id");
  const categoriaOyAId = optionalId("categoriaOyAId");

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
