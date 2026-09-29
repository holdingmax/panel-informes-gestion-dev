"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

const INCLUDE = {
  empresa: true,
  partidaPatrimonial: true,
  rubro: true,
  subrubro: true,
  subrubro2: true,
  subrubro3: true,
  categoriaOyA: true,
} as const;

export async function listPlanDeCuentasPorEmpresas(empresaIds: number[]) {
  await requireUser();
  return prisma.planDeCuentas.findMany({
    where: { empresaId: { in: empresaIds } },
    include: INCLUDE,
    orderBy: [{ empresaId: "asc" }, { cuenta: "asc" }],
  });
}

function readCampos(formData: FormData) {
  const cuenta = String(formData.get("cuenta") ?? "").trim();
  if (!cuenta) throw new Error("La cuenta es obligatoria");
  if (cuenta.length > 90) throw new Error("La cuenta no puede superar 90 caracteres");

  const partidaPatrimonialId = Number(formData.get("partidaPatrimonialId"));
  const rubroId = Number(formData.get("rubroId"));
  const subrubroId = Number(formData.get("subrubroId"));

  if ([partidaPatrimonialId, rubroId, subrubroId].some((value) => !Number.isInteger(value))) {
    throw new Error("Completá Cuenta, Partida, Rubro y Subrubro");
  }

  const optionalId = (field: string) => {
    const raw = String(formData.get(field) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) ? value : null;
  };

  return {
    cuenta,
    partidaPatrimonialId,
    rubroId,
    subrubroId,
    subrubro2Id: optionalId("subrubro2Id"),
    subrubro3Id: optionalId("subrubro3Id"),
    categoriaOyAId: optionalId("categoriaOyAId"),
  };
}

export async function createPlanDeCuentas(formData: FormData) {
  await requireAdmin();
  const empresaId = Number(formData.get("empresaId"));
  if (!Number.isInteger(empresaId)) throw new Error("Completá la Empresa");

  const campos = readCampos(formData);

  await prisma.planDeCuentas.create({ data: { empresaId, ...campos } });

  revalidatePath("/configuracion/plan-de-cuentas");
}

export async function updatePlanDeCuentas(id: string, formData: FormData) {
  await requireAdmin();
  const campos = readCampos(formData);

  await prisma.planDeCuentas.update({ where: { id }, data: campos });

  revalidatePath("/configuracion/plan-de-cuentas");
}

// Nada más hace referencia a una fila de PlanDeCuentas por su id (el BSyS
// solo guarda el texto de la cuenta, no un FK) — siempre se puede borrar.
export async function checkDeletePlanDeCuentas(): Promise<DeleteCheckResult> {
  await requireUser();
  return { blocked: false };
}

export async function deletePlanDeCuentas(id: string) {
  await requireAdmin();
  await prisma.planDeCuentas.delete({ where: { id } });
  revalidatePath("/configuracion/plan-de-cuentas");
}
