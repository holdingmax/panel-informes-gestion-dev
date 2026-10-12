"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { BucketNOF } from "@/generated/prisma/enums";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin, requireAccesoUnidad } from "@/lib/authz";

export async function listRubrosConClasificacion() {
  await requireUser();
  return prisma.rubro.findMany({
    orderBy: { codRubro: "asc" },
    include: { partidaPatrimonial: { include: { tipo: true } } },
  });
}

// El Tipo de la Partida Patrimonial elegida decide dónde cae este Rubro en
// el ESP (Activo/Pasivo/Patrimonio Neto) o si es de Resultado — uniforma la
// clasificación para el operador y evita el bug de mezclar Partidas dentro
// de un mismo Rubro (ver AGENTS.md / sesión del rediseño).
export async function updateRubroPartida(codRubro: number, value: string) {
  await requireAdmin();
  const partidaPatrimonialId = value ? Number(value) : null;
  await prisma.rubro.update({
    where: { codRubro },
    data: { partidaPatrimonialId: partidaPatrimonialId && Number.isInteger(partidaPatrimonialId) ? partidaPatrimonialId : null },
  });
  revalidatePath("/configuracion/rubro");
}

// CTO/ONP/ARS de un Rubro para UNA Unidad de Negocio — el selector del ESP.
// Es criterio del operador de cada unidad y varias unidades confeccionan a la
// vez, así que se guarda por unidad (RubroUnidadNOF) y no toca a las demás;
// alcanza con el permiso de confeccionar informes de esa unidad. Sin elección
// la unidad usa el default del Rubro (Rubro.bucketNOF).
export async function updateRubroBucketNOFDeUnidad(
  unidadNegocioId: number,
  codRubro: number,
  value: string
) {
  await requireAccesoUnidad(unidadNegocioId, "confeccionar");
  const bucketNOF: BucketNOF | null =
    value === "OPERATIVO" || value === "NO_OPERATIVO" || value === "FINANCIAMIENTO" ? value : null;
  await prisma.rubroUnidadNOF.upsert({
    where: { unidadNegocioId_codRubro: { unidadNegocioId, codRubro } },
    update: { bucketNOF },
    create: { unidadNegocioId, codRubro, bucketNOF },
  });
}

// Orden de exposición dentro del ESP (Activo/Pasivo/Patrimonio Neto se
// ordenan por este valor — ver computeInformeReport). Vacío = sin orden
// asignado, va al final.
export async function updateRubroOrden(codRubro: number, value: string) {
  await requireAdmin();
  const trimmed = value.trim();
  const orden = trimmed === "" ? null : Number(trimmed);
  if (orden !== null && !Number.isInteger(orden)) {
    throw new Error("El orden debe ser un número entero.");
  }
  await prisma.rubro.update({ where: { codRubro }, data: { orden } });
  revalidatePath("/configuracion/rubro");
}

export async function updateRubroNombre(codRubro: number, nomRubro: string) {
  await requireAdmin();
  const value = nomRubro.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.rubro.update({ where: { codRubro }, data: { nomRubro: value } });
  revalidatePath("/configuracion/rubro");
}

export async function checkDeleteRubro(codRubro: number): Promise<DeleteCheckResult> {
  await requireUser();
  const cantidad = await prisma.planDeCuentas.count({ where: { rubroId: codRubro } });
  if (cantidad === 0) return { blocked: false };
  return {
    blocked: true,
    reason: `No se puede eliminar: ${cantidad} cuenta(s) del Plan de Cuentas todavía lo usan. Reclasificalas primero en Configuración → Plan de Cuentas.`,
  };
}

export async function deleteRubro(codRubro: number) {
  await requireAdmin();
  const check = await checkDeleteRubro(codRubro);
  if (check.blocked) throw new Error(check.reason);

  await prisma.rubro.delete({ where: { codRubro } });
  revalidatePath("/configuracion/rubro");
}
