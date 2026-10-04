"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAccesoUnidad } from "@/lib/authz";

// Documentación general del informe (panel Consulta) — concepto aparte de
// los adjuntos de una Reclasificación puntual. Mismo tope y mismos tipos
// permitidos (ver reclasificacion-actions.ts).
const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

async function revalidarConsulta(unidadNegocioId: number) {
  revalidatePath(`/consulta/${unidadNegocioId}`);
}

export async function subirInformeAdjunto(informeId: string, formData: FormData) {
  const session = await requireUser();
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });
  await requireAccesoUnidad(informe.unidadNegocioId, "adjuntar");

  const file = formData.get("adjunto");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Seleccioná un archivo.");
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error(`"${file.name}": tipo de archivo no permitido (usar imagen, PDF, Word o Excel).`);
  }
  if (file.size > MAX_ADJUNTO_BYTES) {
    throw new Error(`"${file.name}" supera el tope de 10MB por archivo.`);
  }

  const contenido: Uint8Array<ArrayBuffer> = new Uint8Array(await file.arrayBuffer());
  await prisma.informeAdjunto.create({
    data: {
      informeId,
      nombreArchivo: file.name,
      mimeType: file.type,
      contenido,
      createdByUserId: session.user.id,
    },
  });

  await revalidarConsulta(informe.unidadNegocioId);
}

export async function eliminarInformeAdjunto(adjuntoId: string) {
  const adjunto = await prisma.informeAdjunto.findUniqueOrThrow({
    where: { id: adjuntoId },
    include: { informe: true },
  });
  await requireAccesoUnidad(adjunto.informe.unidadNegocioId, "adjuntar");

  await prisma.informeAdjunto.delete({ where: { id: adjuntoId } });
  await revalidarConsulta(adjunto.informe.unidadNegocioId);
}
