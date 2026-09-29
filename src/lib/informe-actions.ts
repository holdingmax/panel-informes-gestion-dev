"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeResultadoNominalMes } from "@/lib/resultado-nominal";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

export async function listInformes(unidadNegocioId: number) {
  await requireUser();
  return prisma.informe.findMany({
    where: { unidadNegocioId },
    orderBy: [{ periodoAnio: "desc" }, { periodoMes: "desc" }],
  });
}

// Editar/Eliminar un Informe solo tiene sentido mientras está "En proceso":
// una vez que avanza a En Revisión (y sobre todo a Aprobado, que ya
// completó Resultados Históricos) borrarlo dejaría ese dato histórico
// huérfano de su informe de origen.
export async function checkDeleteInforme(informeId: string): Promise<DeleteCheckResult> {
  await requireUser();
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });
  if (informe.estado !== "PROCESO") {
    return {
      blocked: true,
      reason: "Solo se puede eliminar un informe mientras está En proceso.",
    };
  }
  return { blocked: false };
}

export async function deleteInforme(informeId: string) {
  await requireUser();
  const check = await checkDeleteInforme(informeId);
  if (check.blocked) throw new Error(check.reason);

  const informe = await prisma.informe.delete({ where: { id: informeId } });
  revalidatePath(`/empresa/${informe.unidadNegocioId}/historico`);
}

const SIGUIENTE_ESTADO = {
  PROCESO: "EN_REVISION",
  EN_REVISION: "APROBADO",
  APROBADO: "DEFINITIVO",
  DEFINITIVO: null,
} as const;

export async function avanzarEstadoInforme(informeId: string) {
  await requireUser();
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });
  const siguiente = SIGUIENTE_ESTADO[informe.estado];
  if (!siguiente) return;

  // Solo ADMIN puede aprobar o dar por definitivo un informe — un USER
  // puede como mucho mandarlo a En Revisión.
  if (siguiente === "APROBADO" || siguiente === "DEFINITIVO") {
    await requireAdmin();
  }

  await prisma.informe.update({ where: { id: informeId }, data: { estado: siguiente } });

  // Al aprobar por primera vez, la tabla Resultados Históricos de la unidad
  // de negocio se completa con el período de este informe. Nunca se pisa un
  // período que ya tiene datos (ni de una aprobación anterior ni de una
  // carga histórica manual) — create-only, no update.
  if (siguiente === "APROBADO") {
    const { valores } = await computeResultadoNominalMes(
      informe.unidadNegocioId,
      informe.periodoMes,
      informe.periodoAnio
    );
    if (valores) {
      await prisma.resultadosHistoricos.upsert({
        where: {
          unidadNegocioId_periodoMes_periodoAnio: {
            unidadNegocioId: informe.unidadNegocioId,
            periodoMes: informe.periodoMes,
            periodoAnio: informe.periodoAnio,
          },
        },
        update: {},
        create: {
          unidadNegocioId: informe.unidadNegocioId,
          periodoMes: informe.periodoMes,
          periodoAnio: informe.periodoAnio,
          ventas: valores.ventas,
          costosDirectos: valores.costosDirectos,
          gastosOperativos: valores.gastosOperativos,
          expensas: valores.expensas,
          otrasGananciasYPerdidas: valores.otrasGananciasYPerdidas,
        },
      });
    }
  }

  revalidatePath(`/empresa/${informe.unidadNegocioId}/informe/${informeId}`);
  revalidatePath(`/empresa/${informe.unidadNegocioId}/historico`);
}
