"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser } from "@/lib/authz";
import { requireAccesoConfiguracionEmpresa, requireAccesoEmpresa } from "@/lib/empresa-authz";

const INCLUDE = {
  empresa: true,
  rubro: { include: { partidaPatrimonial: true } },
  subrubro: true,
  subrubro2: true,
  subrubro3: true,
  unidadNegocio: true,
} as const;

export async function listPlanDeCuentasPorEmpresas(empresaIds: number[]) {
  await requireUser();
  // Una Empresa sin Unidad todavía no tiene a quién delegarle el permiso: solo
  // un ADMIN (ver requireAccesoEmpresa).
  for (const empresaId of new Set(empresaIds)) await requireAccesoEmpresa(empresaId);
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
  };
}

// "Cuit compartido": en una Empresa que comparte BSyS cada cuenta pertenece a
// una de sus Unidades (obligatorio); en el resto no se usa y queda en null.
async function leerUnidadDeCuenta(empresaId: number, formData: FormData): Promise<number | null> {
  const empresa = await prisma.empresa.findUniqueOrThrow({
    where: { codEmp: empresaId },
    select: { comparteBsys: true, unidades: { select: { unidadNegocioId: true } } },
  });
  if (!empresa.comparteBsys) return null;

  const raw = String(formData.get("unidadNegocioId") ?? "").trim();
  const unidadNegocioId = Number(raw);
  if (!raw || !Number.isInteger(unidadNegocioId)) {
    throw new Error("Elegí el Cuit compartido (la unidad de negocio a la que pertenece la cuenta).");
  }
  if (!empresa.unidades.some((u) => u.unidadNegocioId === unidadNegocioId)) {
    throw new Error("Esa unidad de negocio no comparte esta empresa.");
  }
  return unidadNegocioId;
}

const ERROR_CUENTA_DUPLICADA = "Ya existe una cuenta con ese nombre en esta empresa.";

function esCuentaDuplicada(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createPlanDeCuentas(formData: FormData): Promise<{ error: string } | undefined> {
  const empresaId = Number(formData.get("empresaId"));
  if (!Number.isInteger(empresaId)) throw new Error("Completá la Empresa");
  await requireAccesoConfiguracionEmpresa(empresaId);

  const campos = readCampos(formData);
  const unidadNegocioId = await leerUnidadDeCuenta(empresaId, formData);

  try {
    await prisma.planDeCuentas.create({ data: { empresaId, ...campos, unidadNegocioId } });
  } catch (e) {
    if (esCuentaDuplicada(e)) return { error: ERROR_CUENTA_DUPLICADA };
    throw e;
  }

  revalidatePath("/configuracion/plan-de-cuentas");
}

export async function updatePlanDeCuentas(
  id: string,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const existente = await prisma.planDeCuentas.findUniqueOrThrow({ where: { id }, select: { empresaId: true } });
  await requireAccesoConfiguracionEmpresa(existente.empresaId);

  const campos = readCampos(formData);
  const unidadNegocioId = await leerUnidadDeCuenta(existente.empresaId, formData);

  try {
    await prisma.planDeCuentas.update({ where: { id }, data: { ...campos, unidadNegocioId } });
  } catch (e) {
    if (esCuentaDuplicada(e)) return { error: ERROR_CUENTA_DUPLICADA };
    throw e;
  }

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
