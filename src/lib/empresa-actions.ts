"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin, requireAccesoUnidad, unidadesAccesibles } from "@/lib/authz";
import {
  requireAccesoConfiguracionEmpresa,
  requireAccesoEmpresa,
  unidadIdsDeEmpresa,
} from "@/lib/empresa-authz";

const INCLUDE_LISTA = {
  unidades: {
    select: { unidadNegocio: { select: { codUnidad: true, nombreUnidad: true } } },
  },
  monedaPrimaria: { select: { codMoneda: true, nomMoneda: true, simbolo: true } },
  monedaSecundaria: { select: { codMoneda: true, nomMoneda: true, simbolo: true } },
  monedaActualiza: { select: { codMoneda: true, nomMoneda: true, simbolo: true } },
} as const;

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
        : {
            OR: [
              { unidades: { some: { unidadNegocioId: { in: accesibles } } } },
              { unidades: { none: {} } },
            ],
          },
    orderBy: { codEmp: "asc" },
    include: INCLUDE_LISTA,
  });
}

export async function listEmpresasDeUnidad(unidadNegocioId: number) {
  await requireAccesoUnidad(unidadNegocioId);
  return prisma.empresa.findMany({
    where: { unidades: { some: { unidadNegocioId } } },
    orderBy: { nombreEmp: "asc" },
    include: {
      unidades: { select: { unidadNegocio: { select: { codUnidad: true, nombreUnidad: true } } } },
    },
  });
}

export async function getEmpresa(codEmp: number) {
  await requireUser();
  const empresa = await prisma.empresa.findUnique({ where: { codEmp } });
  if (empresa) await requireAccesoEmpresa(codEmp);
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
      comparteBsys: formData.get("comparteBsys") === "si",
    },
  });

  revalidatePath("/configuracion/empresas");
}

// Prender o apagar "Comparte BSyS" cambia cómo se asignan las cuentas del Plan
// de Cuentas a las Unidades (ver PlanDeCuentas.unidadNegocioId) y afecta a
// todas las Unidades de la Empresa, así que solo lo cambia un ADMIN. Devuelve
// { error } (no lanza) para que el mensaje llegue a la pantalla.
async function aplicarCambioComparteBsys(
  codEmp: number,
  nuevo: boolean
): Promise<{ error: string } | undefined> {
  const actual = await prisma.empresa.findUniqueOrThrow({
    where: { codEmp },
    select: { comparteBsys: true },
  });
  if (actual.comparteBsys === nuevo) return;

  const session = await requireUser();
  if (session.user.role !== "ADMIN") {
    return { error: 'Solo un administrador puede cambiar "Comparte BSyS".' };
  }

  const unidadIds = await unidadIdsDeEmpresa(codEmp);
  if (nuevo) {
    if (unidadIds.length === 0) {
      return {
        error:
          "Vinculá primero la empresa a una unidad de negocio (Configuración → Unidades de Negocio) para poder compartir su BSyS.",
      };
    }
    // Hasta ahora estaba en una sola unidad: todas sus cuentas quedan
    // asignadas a ella (cada cuenta tiene que tener unidad en una empresa
    // que comparte).
    await prisma.$transaction([
      prisma.planDeCuentas.updateMany({
        where: { empresaId: codEmp, unidadNegocioId: null },
        data: { unidadNegocioId: unidadIds[0] },
      }),
      prisma.empresa.update({ where: { codEmp }, data: { comparteBsys: true } }),
    ]);
  } else {
    if (unidadIds.length > 1) {
      return {
        error: `La empresa está vinculada a ${unidadIds.length} unidades de negocio: dejala en una sola antes de desactivar "Comparte BSyS".`,
      };
    }
    await prisma.$transaction([
      prisma.planDeCuentas.updateMany({
        where: { empresaId: codEmp },
        data: { unidadNegocioId: null },
      }),
      prisma.empresa.update({ where: { codEmp }, data: { comparteBsys: false } }),
    ]);
  }
}

export async function updateEmpresa(
  codEmp: number,
  formData: FormData
): Promise<{ error: string } | undefined> {
  await requireAccesoConfiguracionEmpresa(codEmp);
  const nombreEmp = String(formData.get("nombreEmp") ?? "").trim();
  if (!nombreEmp) throw new Error("El nombre es obligatorio");
  if (nombreEmp.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  const cambio = await aplicarCambioComparteBsys(codEmp, formData.get("comparteBsys") === "si");
  if (cambio) return cambio;

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
