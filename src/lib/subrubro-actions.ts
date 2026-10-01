"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CampoResultado } from "@/generated/prisma/enums";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

export async function listSubrubrosConClasificacion() {
  await requireUser();
  return prisma.subrubro.findMany({ orderBy: { codSubrubro: "asc" } });
}

const CAMPOS_VALIDOS: CampoResultado[] = [
  "VENTAS",
  "COSTOS_DIRECTOS",
  "GASTOS_OPERATIVOS",
  "EXPENSAS",
  "OTRAS_GANANCIAS_PERDIDAS",
];

// Exclusivo de Subrubros usados en cuentas de Resultado (Ingresos/Egresos) —
// decide a qué campo del ER (cuadro Nominal) aporta cada cuenta. Ver
// computeResultadoNominalDeEmpresaPure (resultado-nominal.ts).
export async function updateSubrubroCampoResultado(codSubrubro: number, value: string) {
  await requireAdmin();
  const campoResultado = CAMPOS_VALIDOS.includes(value as CampoResultado)
    ? (value as CampoResultado)
    : null;
  await prisma.subrubro.update({ where: { codSubrubro }, data: { campoResultado } });
  revalidatePath("/configuracion/subrubro");
}

export async function updateSubrubroNombre(codSubrubro: number, nomSubrubro: string) {
  await requireAdmin();
  const value = nomSubrubro.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.subrubro.update({ where: { codSubrubro }, data: { nomSubrubro: value } });
  revalidatePath("/configuracion/subrubro");
}

export async function checkDeleteSubrubro(codSubrubro: number): Promise<DeleteCheckResult> {
  await requireUser();
  const cantidad = await prisma.planDeCuentas.count({ where: { subrubroId: codSubrubro } });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} cuenta(s) del Plan de Cuentas todavía lo usan. Reclasificalas primero en Configuración → Plan de Cuentas.`,
  };
}

export async function deleteSubrubro(codSubrubro: number) {
  await requireAdmin();
  const check = await checkDeleteSubrubro(codSubrubro);
  if (check.blocked) throw new Error(check.reason);

  await prisma.subrubro.delete({ where: { codSubrubro } });
  revalidatePath("/configuracion/subrubro");
}
