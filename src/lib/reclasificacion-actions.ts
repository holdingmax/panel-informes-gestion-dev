"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAccesoUnidad } from "@/lib/authz";

const MAX_ADJUNTOS = 3;
const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024; // 10MB — ver plan: tope acordado para Reclasificación/Informe.
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

const INCLUDE_COMPLETO = {
  empresa: true,
  lineas: { include: { planDeCuenta: true } },
  // Nunca se trae `contenido` acá — son filas potencialmente de varios MB,
  // solo hace falta para servir la descarga puntual (ver route de adjuntos).
  adjuntos: { select: { id: true, nombreArchivo: true, mimeType: true, createdAt: true } },
} as const;

export async function listReclasificacionesDeInforme(informeId: string) {
  await requireUser();
  return prisma.reclasificacion.findMany({
    where: { informeId },
    include: INCLUDE_COMPLETO,
    orderBy: { createdAt: "desc" },
  });
}

// Para la ventana "Recuperar Reclasificación" — todas las de esta Empresa,
// en cualquier informe/período, para poder copiar una a el informe actual.
export async function listReclasificacionesDeEmpresa(empresaId: number) {
  await requireUser();
  return prisma.reclasificacion.findMany({
    where: { empresaId },
    include: {
      ...INCLUDE_COMPLETO,
      informe: { select: { periodoMes: true, periodoAnio: true, version: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Mismo criterio que checkDeleteInforme: solo se puede tocar mientras el
// informe está En proceso. Una vez que avanza, la reclasificación queda
// fija — su efecto ya quedó congelado en el snapshot al aprobar.
export async function checkEditableReclasificacion(informeId: string): Promise<DeleteCheckResult> {
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });
  await requireAccesoUnidad(informe.unidadNegocioId);
  if (informe.estado !== "PROCESO") {
    return {
      blocked: true,
      reason: "Solo se puede agregar, editar o eliminar una reclasificación mientras el informe está En proceso.",
    };
  }
  return { blocked: false };
}

type LineaInput = { planDeCuentaId: string; debe: number; haber: number };

function leerLineas(formData: FormData): LineaInput[] {
  const planDeCuentaIds = formData.getAll("lineaPlanDeCuentaId").map(String);
  const debes = formData.getAll("lineaDebe").map((v) => Number(v || 0));
  const habers = formData.getAll("lineaHaber").map((v) => Number(v || 0));

  if (planDeCuentaIds.length < 2) {
    throw new Error("Una reclasificación necesita al menos 2 líneas (origen y destino).");
  }
  const lineas: LineaInput[] = planDeCuentaIds.map((id, i) => ({
    planDeCuentaId: id,
    debe: debes[i] ?? 0,
    haber: habers[i] ?? 0,
  }));
  if (lineas.some((l) => !l.planDeCuentaId)) {
    throw new Error("Completá la cuenta en todas las líneas.");
  }
  if (lineas.some((l) => !Number.isFinite(l.debe) || !Number.isFinite(l.haber) || l.debe < 0 || l.haber < 0)) {
    throw new Error("Debe y Haber tienen que ser números mayores o iguales a cero.");
  }
  if (lineas.some((l) => l.debe === 0 && l.haber === 0)) {
    throw new Error("Cada línea necesita un importe en Debe o en Haber.");
  }
  const totalDebe = lineas.reduce((a, l) => a + l.debe, 0);
  const totalHaber = lineas.reduce((a, l) => a + l.haber, 0);
  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    throw new Error(
      `La suma de Debe (${totalDebe.toFixed(2)}) y Haber (${totalHaber.toFixed(2)}) debe ser igual para poder guardar.`
    );
  }
  return lineas;
}

async function leerAdjuntosNuevos(
  formData: FormData,
  yaExistentes: number
): Promise<{ nombreArchivo: string; mimeType: string; contenido: Uint8Array<ArrayBuffer> }[]> {
  const archivos = formData.getAll("adjuntos").filter((f): f is File => f instanceof File && f.size > 0);
  if (yaExistentes + archivos.length > MAX_ADJUNTOS) {
    throw new Error(`Hasta ${MAX_ADJUNTOS} adjuntos por reclasificación.`);
  }
  const resultado: { nombreArchivo: string; mimeType: string; contenido: Uint8Array<ArrayBuffer> }[] = [];
  for (const file of archivos) {
    if (!ALLOWED_MIME.includes(file.type)) {
      throw new Error(`"${file.name}": tipo de archivo no permitido (usar imagen, PDF, Word o Excel).`);
    }
    if (file.size > MAX_ADJUNTO_BYTES) {
      throw new Error(`"${file.name}" supera el tope de 10MB por archivo.`);
    }
    const contenido: Uint8Array<ArrayBuffer> = new Uint8Array(await file.arrayBuffer());
    resultado.push({ nombreArchivo: file.name, mimeType: file.type, contenido });
  }
  return resultado;
}

function leerDetalle(formData: FormData): string {
  const detalle = String(formData.get("detalle") ?? "").trim();
  if (!detalle) throw new Error("El detalle es obligatorio.");
  if (detalle.length > 500) throw new Error("El detalle no puede superar 500 caracteres.");
  return detalle;
}

async function revalidarPanel(informeId: string) {
  const informe = await prisma.informe.findUnique({
    where: { id: informeId },
    select: { unidadNegocioId: true },
  });
  if (informe) revalidatePath(`/empresa/${informe.unidadNegocioId}/panel-reclasificacion`);
}

export async function createReclasificacion(
  informeId: string,
  empresaId: number,
  formData: FormData
) {
  const session = await requireUser();
  const check = await checkEditableReclasificacion(informeId);
  if (check.blocked) throw new Error(check.reason);

  const detalle = leerDetalle(formData);
  const lineas = leerLineas(formData);
  const adjuntos = await leerAdjuntosNuevos(formData, 0);

  await prisma.reclasificacion.create({
    data: {
      informeId,
      empresaId,
      detalle,
      createdByUserId: session.user.id,
      lineas: { create: lineas },
      adjuntos: { create: adjuntos },
    },
  });

  await revalidarPanel(informeId);
}

export async function updateReclasificacion(id: string, formData: FormData) {
  await requireUser();
  const existente = await prisma.reclasificacion.findUniqueOrThrow({
    where: { id },
    include: { adjuntos: { select: { id: true } } },
  });
  const check = await checkEditableReclasificacion(existente.informeId);
  if (check.blocked) throw new Error(check.reason);

  const detalle = leerDetalle(formData);
  const lineas = leerLineas(formData);
  const adjuntosNuevos = await leerAdjuntosNuevos(formData, existente.adjuntos.length);

  await prisma.$transaction(async (tx) => {
    await tx.reclasificacionLinea.deleteMany({ where: { reclasificacionId: id } });
    await tx.reclasificacion.update({
      where: { id },
      data: {
        detalle,
        lineas: { create: lineas },
        adjuntos: { create: adjuntosNuevos },
      },
    });
  });

  await revalidarPanel(existente.informeId);
}

export async function checkDeleteReclasificacion(id: string): Promise<DeleteCheckResult> {
  await requireUser();
  const reclasificacion = await prisma.reclasificacion.findUniqueOrThrow({ where: { id } });
  return checkEditableReclasificacion(reclasificacion.informeId);
}

export async function deleteReclasificacion(id: string) {
  await requireUser();
  const check = await checkDeleteReclasificacion(id);
  if (check.blocked) throw new Error(check.reason);

  const reclasificacion = await prisma.reclasificacion.delete({ where: { id } });
  await revalidarPanel(reclasificacion.informeId);
}

export async function deleteReclasificacionAdjunto(adjuntoId: string) {
  await requireUser();
  const adjunto = await prisma.reclasificacionAdjunto.findUniqueOrThrow({
    where: { id: adjuntoId },
    include: { reclasificacion: true },
  });
  const check = await checkEditableReclasificacion(adjunto.reclasificacion.informeId);
  if (check.blocked) throw new Error(check.reason);

  await prisma.reclasificacionAdjunto.delete({ where: { id: adjuntoId } });
  await revalidarPanel(adjunto.reclasificacion.informeId);
}

// Duplica una reclasificación completa (líneas + adjuntos) en el informe
// que se está trabajando — ver botón "Recuperar Reclasificación" →
// "Copiar". Las cuentas de las líneas se mantienen igual (misma Empresa
// siempre, ver listReclasificacionesDeEmpresa).
export async function copiarReclasificacion(reclasificacionId: string, informeDestinoId: string) {
  const session = await requireUser();
  const check = await checkEditableReclasificacion(informeDestinoId);
  if (check.blocked) throw new Error(check.reason);

  const origen = await prisma.reclasificacion.findUniqueOrThrow({
    where: { id: reclasificacionId },
    include: {
      lineas: true,
      adjuntos: true,
    },
  });

  await prisma.reclasificacion.create({
    data: {
      informeId: informeDestinoId,
      empresaId: origen.empresaId,
      detalle: origen.detalle,
      createdByUserId: session.user.id,
      lineas: {
        create: origen.lineas.map((l) => ({
          planDeCuentaId: l.planDeCuentaId,
          debe: l.debe,
          haber: l.haber,
        })),
      },
      adjuntos: {
        create: origen.adjuntos.map((a) => ({
          nombreArchivo: a.nombreArchivo,
          mimeType: a.mimeType,
          contenido: a.contenido,
        })),
      },
    },
  });

  await revalidarPanel(informeDestinoId);
}
