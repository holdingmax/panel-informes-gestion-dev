"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeResultadoNominalMes } from "@/lib/resultado-nominal";

export async function listInformes(empresaId: number) {
  return prisma.informe.findMany({
    where: { empresaId },
    orderBy: [{ periodoAnio: "desc" }, { periodoMes: "desc" }],
  });
}

const SIGUIENTE_ESTADO = {
  PROCESO: "EN_REVISION",
  EN_REVISION: "APROBADO",
  APROBADO: "DEFINITIVO",
  DEFINITIVO: null,
} as const;

export async function avanzarEstadoInforme(informeId: string) {
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });
  const siguiente = SIGUIENTE_ESTADO[informe.estado];
  if (!siguiente) return;

  await prisma.informe.update({ where: { id: informeId }, data: { estado: siguiente } });

  // Al aprobar por primera vez, la tabla Resultados Históricos de la empresa
  // se completa con el período de este informe. Nunca se pisa un período que
  // ya tiene datos (ni de una aprobación anterior ni de una carga histórica
  // manual) — create-only, no update.
  if (siguiente === "APROBADO") {
    const { valores } = await computeResultadoNominalMes(informe.empresaId);
    if (valores) {
      await prisma.resultadosHistoricos.upsert({
        where: {
          empresaId_periodoMes_periodoAnio: {
            empresaId: informe.empresaId,
            periodoMes: informe.periodoMes,
            periodoAnio: informe.periodoAnio,
          },
        },
        update: {},
        create: {
          empresaId: informe.empresaId,
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

  revalidatePath(`/empresa/${informe.empresaId}/informe/${informeId}`);
  revalidatePath(`/empresa/${informe.empresaId}/historico`);
}
