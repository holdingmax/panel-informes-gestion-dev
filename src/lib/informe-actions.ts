"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
  revalidatePath(`/empresa/${informe.empresaId}/informe/${informeId}`);
  revalidatePath(`/empresa/${informe.empresaId}/historico`);
}
