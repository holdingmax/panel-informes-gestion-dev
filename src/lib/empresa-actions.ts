"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";

export async function listEmpresas() {
  return prisma.empresa.findMany({
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
  return prisma.empresa.findMany({
    where: { unidadNegocioId },
    orderBy: { nombreEmp: "asc" },
  });
}

export async function getEmpresa(codEmp: number) {
  return prisma.empresa.findUnique({ where: { codEmp } });
}

function optionalMonedaId(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export async function createEmpresa(formData: FormData) {
  const nombreEmp = String(formData.get("nombreEmp") ?? "").trim();
  if (!nombreEmp) throw new Error("El nombre es obligatorio");
  if (nombreEmp.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.empresa.create({
    data: {
      nombreEmp,
      monedaPrimariaId: optionalMonedaId(formData, "monedaPrimariaId"),
      monedaSecundariaId: optionalMonedaId(formData, "monedaSecundariaId"),
      actualiza: formData.get("actualiza") === "on",
      monedaActualizaId: optionalMonedaId(formData, "monedaActualizaId"),
    },
  });

  revalidatePath("/configuracion/empresas");
}

export async function updateEmpresa(codEmp: number, formData: FormData) {
  const nombreEmp = String(formData.get("nombreEmp") ?? "").trim();
  if (!nombreEmp) throw new Error("El nombre es obligatorio");
  if (nombreEmp.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.empresa.update({
    where: { codEmp },
    data: {
      nombreEmp,
      monedaPrimariaId: optionalMonedaId(formData, "monedaPrimariaId"),
      monedaSecundariaId: optionalMonedaId(formData, "monedaSecundariaId"),
      actualiza: formData.get("actualiza") === "on",
      monedaActualizaId: optionalMonedaId(formData, "monedaActualizaId"),
    },
  });

  revalidatePath("/configuracion/empresas");
}

export async function checkDeleteEmpresa(codEmp: number): Promise<DeleteCheckResult> {
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
  const check = await checkDeleteEmpresa(codEmp);
  if (check.blocked) throw new Error(check.reason);

  await prisma.empresa.delete({ where: { codEmp } });
  revalidatePath("/configuracion/empresas");
}
