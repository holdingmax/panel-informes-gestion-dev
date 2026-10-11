"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin, requireAccesoUnidad, unidadesAccesibles } from "@/lib/authz";

// La Empresa es el recurso, pero el permiso se concede por Unidad de
// Negocio (ver UserUnidadPermiso). Una Empresa sin vincular todavía
// (unidadNegocioId null) solo la puede tocar un ADMIN.
async function requireAccesoConfiguracionEmpresa(codEmp: number) {
  const empresa = await prisma.empresa.findUniqueOrThrow({
    where: { codEmp },
    select: { unidadNegocioId: true },
  });
  if (empresa.unidadNegocioId === null) {
    await requireAdmin();
    return;
  }
  await requireAccesoUnidad(empresa.unidadNegocioId, "configuracion");
}

// Un USER solo ve las Empresas de las Unidades a las que tiene acceso, más
// las todavía sin vincular (sin datos propios, hay que poder elegirlas al
// armar una Unidad).
export async function listEmpresas() {
  await requireUser();
  const accesibles = await unidadesAccesibles("cualquiera");
  return prisma.empresa.findMany({
    where:
      accesibles === "todas"
        ? undefined
        : { OR: [{ unidadNegocioId: { in: accesibles } }, { unidadNegocioId: null }] },
    orderBy: { codEmp: "asc" },
    include: {
      unidadNegocio: { select: { codUnidad: true, nombreUnidad: true } },
      monedaPrimaria: { select: { codMoneda: true, nomMoneda: true, simbolo: true } },
      monedaSecundaria: { select: { codMoneda: true, nomMoneda: true, simbolo: true } },
      monedaActualiza: { select: { codMoneda: true, nomMoneda: true, simbolo: true } },
    },
  });
}

export async function listEmpresasDeUnidad(unidadNegocioId: number) {
  await requireAccesoUnidad(unidadNegocioId);
  return prisma.empresa.findMany({
    where: { unidadNegocioId },
    orderBy: { nombreEmp: "asc" },
  });
}

export async function getEmpresa(codEmp: number) {
  await requireUser();
  const empresa = await prisma.empresa.findUnique({ where: { codEmp } });
  if (empresa?.unidadNegocioId != null) {
    await requireAccesoUnidad(empresa.unidadNegocioId);
  }
  return empresa;
}

function optionalMonedaId(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export async function createEmpresa(formData: FormData) {
  await requireAdmin();
  const nombreEmp = String(formData.get("nombreEmp") ?? "").trim();
  if (!nombreEmp) throw new Error("El nombre es obligatorio");
  if (nombreEmp.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.empresa.create({
    data: {
      nombreEmp,
      monedaPrimariaId: optionalMonedaId(formData, "monedaPrimariaId"),
      presentaEnMiles: formData.get("presentaEnMiles") === "on",
      monedaSecundariaId: optionalMonedaId(formData, "monedaSecundariaId"),
      actualiza: formData.get("actualiza") === "on",
      monedaActualizaId: optionalMonedaId(formData, "monedaActualizaId"),
    },
  });

  revalidatePath("/configuracion/empresas");
}

export async function updateEmpresa(codEmp: number, formData: FormData) {
  await requireAccesoConfiguracionEmpresa(codEmp);
  const nombreEmp = String(formData.get("nombreEmp") ?? "").trim();
  if (!nombreEmp) throw new Error("El nombre es obligatorio");
  if (nombreEmp.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.empresa.update({
    where: { codEmp },
    data: {
      nombreEmp,
      monedaPrimariaId: optionalMonedaId(formData, "monedaPrimariaId"),
      presentaEnMiles: formData.get("presentaEnMiles") === "on",
      monedaSecundariaId: optionalMonedaId(formData, "monedaSecundariaId"),
      actualiza: formData.get("actualiza") === "on",
      monedaActualizaId: optionalMonedaId(formData, "monedaActualizaId"),
    },
  });

  revalidatePath("/configuracion/empresas");
}

export async function checkDeleteEmpresa(codEmp: number): Promise<DeleteCheckResult> {
  await requireUser();
  const [planes, balances] = await Promise.all([
    prisma.planDeCuentas.count({ where: { empresaId: codEmp } }),
    prisma.balanceSumasYSaldos.count({ where: { empresaId: codEmp } }),
  ]);

  const motivos: string[] = [];
  if (planes > 0) motivos.push(`${planes} cuenta(s) del Plan de Cuentas`);
  if (balances > 0) motivos.push(`${balances} carga(s) de BSyS`);

  if (motivos.length === 0) return { blocked: false };
  return { blocked: true, reason: `No se puede eliminar: tiene ${motivos.join(" y ")}.` };
}

export async function deleteEmpresa(codEmp: number) {
  await requireAccesoConfiguracionEmpresa(codEmp);
  const check = await checkDeleteEmpresa(codEmp);
  if (check.blocked) throw new Error(check.reason);

  await prisma.empresa.delete({ where: { codEmp } });
  revalidatePath("/configuracion/empresas");
}
