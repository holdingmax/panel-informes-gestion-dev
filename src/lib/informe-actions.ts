"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { computeResultadoNominalMes } from "@/lib/resultado-nominal";
import { buildEmpresaBalanceInputs, type InformeSnapshot } from "@/lib/balance-oya-report";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAccesoUnidad } from "@/lib/authz";

export async function listInformes(unidadNegocioId: number) {
  await requireUser();
  return prisma.informe.findMany({
    where: { unidadNegocioId },
    orderBy: [{ periodoAnio: "desc" }, { periodoMes: "desc" }, { version: "desc" }],
  });
}

// Para la pantalla Consulta (todas las versiones, todos los períodos,
// ordenado por fecha de confección) — incluye el resumen de adjuntos
// (nunca `contenido`, ver /api/adjuntos/informe/[id] para la descarga).
export async function listInformesParaConsulta(unidadNegocioId: number) {
  await requireAccesoUnidad(unidadNegocioId);
  return prisma.informe.findMany({
    where: { unidadNegocioId },
    include: {
      adjuntos: { select: { id: true, nombreArchivo: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Editar/Eliminar un Informe solo tiene sentido mientras está "En proceso":
// una vez que avanza a En Revisión (y sobre todo a Aprobado, que ya
// completó Resultados Históricos) borrarlo dejaría ese dato histórico
// huérfano de su informe de origen.
export async function checkDeleteInforme(informeId: string): Promise<DeleteCheckResult> {
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });
  await requireAccesoUnidad(informe.unidadNegocioId);
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
  APROBADO: null,
} as const;

export async function avanzarEstadoInforme(informeId: string) {
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });
  const estadoActual = informe.estado;
  const siguiente = SIGUIENTE_ESTADO[estadoActual];
  if (!siguiente) return;

  // Mandar a Revisión y Aprobar son permisos independientes por Unidad de
  // Negocio (ver UserUnidadPermiso) — ADMIN los tiene siempre. Aprobado es
  // el estado final: congela el informe para siempre (ver snapshot más
  // abajo), no hay paso posterior.
  if (siguiente === "EN_REVISION") {
    await requireAccesoUnidad(informe.unidadNegocioId, "revisar");
  } else if (siguiente === "APROBADO") {
    await requireAccesoUnidad(informe.unidadNegocioId, "aprobar");
  }

  // Se calcula ANTES de la transacción (son lecturas puras) para no dejar
  // la transacción abierta más tiempo del necesario. El snapshot congela
  // para siempre los datos y la clasificación que el informe tenía al
  // aprobarse — ver InformeSnapshot (balance-oya-report.ts) y
  // computeInformeReport/getDetalleRubro/getDetalleSubrubro, que lo leen en
  // vez de recalcular contra el Plan de Cuentas/BSyS actuales una vez que
  // existe.
  let valores: Awaited<ReturnType<typeof computeResultadoNominalMes>>["valores"] = null;
  let snapshot: InformeSnapshot | null = null;
  if (siguiente === "APROBADO") {
    const [esp, er] = await Promise.all([
      buildEmpresaBalanceInputs(informe.id, informe.unidadNegocioId, informe.periodoMes, informe.periodoAnio),
      computeResultadoNominalMes(informe.id, informe.unidadNegocioId, informe.periodoMes, informe.periodoAnio),
    ]);
    valores = er.valores;
    snapshot = {
      esp: {
        periodo: { periodoMes: informe.periodoMes, periodoAnio: informe.periodoAnio },
        fechaCargaAcumulado: esp.fechaCargaAcumulado ? esp.fechaCargaAcumulado.toISOString() : null,
        empresas: esp.empresasInput,
      },
      erActual: {
        valores: er.valores ?? {
          ventas: 0,
          costosDirectos: 0,
          gastosOperativos: 0,
          expensas: 0,
          otrasGananciasYPerdidas: 0,
        },
        cuentas: er.cuentas,
        cuentasSinSubrubro: er.cuentasSinSubrubro,
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    // updateMany (no update) para que dos clics simultáneos no salteen un
    // estado: si el estado ya cambió desde que se leyó arriba, count da 0 y
    // se corta en vez de pisar un avance que ya hizo otra pestaña/usuario.
    const resultado = await tx.informe.updateMany({
      where: { id: informeId, estado: estadoActual },
      data: {
        estado: siguiente,
        ...(snapshot ? { snapshot: snapshot as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    if (resultado.count === 0) {
      throw new Error("El informe cambió de estado. Recargá la página.");
    }

    // Al aprobar por primera vez, la tabla Resultados Históricos de la
    // unidad de negocio se completa con el período de este informe. Nunca
    // se pisa un período que ya tiene datos (ni de una aprobación anterior
    // ni de una carga histórica manual) — create-only, no update.
    if (siguiente === "APROBADO" && valores) {
      await tx.resultadosHistoricos.upsert({
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
  });

  revalidatePath(`/empresa/${informe.unidadNegocioId}/informe/${informeId}`);
  revalidatePath(`/empresa/${informe.unidadNegocioId}/historico`);
  revalidatePath(`/consulta/${informe.unidadNegocioId}`);
}
