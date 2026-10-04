"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin, requireAccesoUnidad } from "@/lib/authz";

// El Plan de Cuentas es por Empresa, pero el permiso se concede por Unidad
// de Negocio (ver UserUnidadPermiso) — se resuelve la unidad dueña de la
// empresa y se chequea ahí. Una Empresa todavía no vinculada a ninguna
// Unidad (recién creada) solo la puede tocar un ADMIN — no hay unidad a la
// cual delegarle el permiso.
async function requireAccesoConfiguracionEmpresa(empresaId: number) {
  const empresa = await prisma.empresa.findUniqueOrThrow({
    where: { codEmp: empresaId },
    select: { unidadNegocioId: true },
  });
  if (empresa.unidadNegocioId === null) {
    await requireAdmin();
    return;
  }
  await requireAccesoUnidad(empresa.unidadNegocioId, "configuracion");
}

const INCLUDE = {
  empresa: true,
  rubro: { include: { partidaPatrimonial: true } },
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

  const optionalId = (field: string) => {
    const raw = String(formData.get(field) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) ? value : null;
  };

  return {
    cuenta,
    // Rubro (ESP) y Subrubro (ER) son ambos opcionales e independientes —
    // una cuenta de Resultado no lleva Rubro, una de Balance no necesita
    // Subrubro.
    rubroId: optionalId("rubroId"),
    subrubroId: optionalId("subrubroId"),
    subrubro2Id: optionalId("subrubro2Id"),
    subrubro3Id: optionalId("subrubro3Id"),
    categoriaOyAId: optionalId("categoriaOyAId"),
  };
}

export async function createPlanDeCuentas(formData: FormData) {
  const empresaId = Number(formData.get("empresaId"));
  if (!Number.isInteger(empresaId)) throw new Error("Completá la Empresa");
  await requireAccesoConfiguracionEmpresa(empresaId);

  const campos = readCampos(formData);

  await prisma.planDeCuentas.create({ data: { empresaId, ...campos } });

  revalidatePath("/configuracion/plan-de-cuentas");
}

export async function updatePlanDeCuentas(id: string, formData: FormData) {
  const existente = await prisma.planDeCuentas.findUniqueOrThrow({ where: { id }, select: { empresaId: true } });
  await requireAccesoConfiguracionEmpresa(existente.empresaId);

  const campos = readCampos(formData);

  await prisma.planDeCuentas.update({ where: { id }, data: campos });

  revalidatePath("/configuracion/plan-de-cuentas");
}

// Reclasificación rápida desde el "ojo" del ESP (drill-down por Rubro) —
// mismo efecto que editar la cuenta en Configuración → Plan de Cuentas. La
// pantalla que la llama ya oculta el botón Editar una vez que el informe
// está congelado (ver DetalleRubro.congelado); no hace falta repetir ese
// chequeo acá porque un informe ya aprobado lee de su snapshot y no se ve
// afectado por este cambio.
export async function updatePlanDeCuentaRubro(id: string, rubroId: number) {
  const existente = await prisma.planDeCuentas.findUniqueOrThrow({ where: { id }, select: { empresaId: true } });
  await requireAccesoConfiguracionEmpresa(existente.empresaId);
  if (!Number.isInteger(rubroId)) throw new Error("Rubro inválido");
  await prisma.planDeCuentas.update({ where: { id }, data: { rubroId } });
  revalidatePath("/configuracion/plan-de-cuentas");
}

// Mismo propósito que updatePlanDeCuentaRubro, para el "ojo" del ER
// (drill-down por Subrubro, cuadro Nominal).
export async function updatePlanDeCuentaSubrubro(id: string, subrubroId: number) {
  const existente = await prisma.planDeCuentas.findUniqueOrThrow({ where: { id }, select: { empresaId: true } });
  await requireAccesoConfiguracionEmpresa(existente.empresaId);
  if (!Number.isInteger(subrubroId)) throw new Error("Subrubro inválido");
  await prisma.planDeCuentas.update({ where: { id }, data: { subrubroId } });
  revalidatePath("/configuracion/plan-de-cuentas");
}

// Nada más hace referencia a una fila de PlanDeCuentas por su id (el BSyS
// solo guarda el texto de la cuenta, no un FK) — siempre se puede borrar.
export async function checkDeletePlanDeCuentas(): Promise<DeleteCheckResult> {
  await requireUser();
  return { blocked: false };
}

export async function deletePlanDeCuentas(id: string) {
  const existente = await prisma.planDeCuentas.findUniqueOrThrow({ where: { id }, select: { empresaId: true } });
  await requireAccesoConfiguracionEmpresa(existente.empresaId);
  await prisma.planDeCuentas.delete({ where: { id } });
  revalidatePath("/configuracion/plan-de-cuentas");
}
