"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin } from "@/lib/authz";

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export async function listUnidadesNegocio() {
  await requireUser();
  return prisma.unidadNegocio.findMany({
    orderBy: { codUnidad: "asc" },
    select: { codUnidad: true, nombreUnidad: true, imagenMime: true },
  });
}

export async function listUnidadesNegocioConEmpresas() {
  await requireUser();
  return prisma.unidadNegocio.findMany({
    orderBy: { codUnidad: "asc" },
    include: { empresas: { orderBy: { nombreEmp: "asc" } } },
  });
}

export async function getUnidadNegocio(codUnidad: number) {
  await requireUser();
  return prisma.unidadNegocio.findUnique({ where: { codUnidad } });
}

export async function createUnidadNegocio(formData: FormData) {
  await requireAdmin();
  const nombreUnidad = String(formData.get("nombreUnidad") ?? "").trim();
  if (!nombreUnidad) throw new Error("El nombre es obligatorio");
  if (nombreUnidad.length > 35) throw new Error("El nombre no puede superar 35 caracteres");

  const file = formData.get("imagen");
  let imagenUnidad: Uint8Array<ArrayBuffer> | undefined;
  let imagenMime: string | undefined;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_MIME.includes(file.type)) {
      throw new Error(
        "Formato de imagen no permitido (usar JPG, PNG, GIF, WebP o SVG)"
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("La imagen no puede superar 2MB");
    }
    imagenUnidad = new Uint8Array(await file.arrayBuffer());
    imagenMime = file.type;
  }

  await prisma.unidadNegocio.create({
    data: { nombreUnidad, imagenUnidad, imagenMime },
  });

  revalidatePath("/configuracion/unidades-negocio");
  revalidatePath("/preparacion-informes");
}

export async function updateUnidadNegocioNombre(codUnidad: number, nombreUnidad: string) {
  await requireAdmin();
  const value = nombreUnidad.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 35) throw new Error("El nombre no puede superar 35 caracteres");

  await prisma.unidadNegocio.update({ where: { codUnidad }, data: { nombreUnidad: value } });
  revalidatePath("/configuracion/unidades-negocio");
  revalidatePath("/preparacion-informes");
}

export async function updateUnidadNegocioLogo(formData: FormData) {
  await requireAdmin();
  const codUnidad = Number(formData.get("codUnidad"));
  const file = formData.get("imagen");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Seleccioná una imagen");
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error("Formato de imagen no permitido (usar JPG, PNG, GIF, WebP o SVG)");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("La imagen no puede superar 2MB");
  }

  const imagenUnidad = new Uint8Array(await file.arrayBuffer());
  await prisma.unidadNegocio.update({
    where: { codUnidad },
    data: { imagenUnidad, imagenMime: file.type },
  });

  revalidatePath("/configuracion/unidades-negocio");
  revalidatePath("/preparacion-informes");
}

export async function checkDeleteUnidadNegocio(codUnidad: number): Promise<DeleteCheckResult> {
  await requireUser();
  const [empresas, informes, historicos] = await Promise.all([
    prisma.empresa.count({ where: { unidadNegocioId: codUnidad } }),
    prisma.informe.count({ where: { unidadNegocioId: codUnidad } }),
    prisma.resultadosHistoricos.count({ where: { unidadNegocioId: codUnidad } }),
  ]);

  const motivos: string[] = [];
  if (empresas > 0) motivos.push(`${empresas} empresa(s) vinculada(s)`);
  if (informes > 0) motivos.push(`${informes} informe(s)`);
  if (historicos > 0) motivos.push(`${historicos} período(s) de Resultados Históricos`);

  if (motivos.length === 0) return { blocked: false };
  return { blocked: true, reason: `No se puede eliminar: tiene ${motivos.join(", ")}.` };
}

export async function deleteUnidadNegocio(codUnidad: number) {
  await requireAdmin();
  const check = await checkDeleteUnidadNegocio(codUnidad);
  if (check.blocked) throw new Error(check.reason);

  await prisma.unidadNegocio.delete({ where: { codUnidad } });
  revalidatePath("/configuracion/unidades-negocio");
  revalidatePath("/preparacion-informes");
}

// Reemplaza por completo el conjunto de Empresas vinculadas a esta Unidad de
// Negocio (lo que llega del <select multiple> del formulario). Una Empresa
// solo puede estar vinculada a una Unidad de Negocio a la vez, así que
// elegirla acá se la saca de donde estuviera antes.
export async function actualizarEmpresasVinculadas(formData: FormData) {
  await requireAdmin();
  const codUnidad = Number(formData.get("codUnidad"));
  const empresaIds = formData.getAll("empresaIds").map(Number).filter(Number.isFinite);

  await prisma.$transaction([
    prisma.empresa.updateMany({
      where: { unidadNegocioId: codUnidad, codEmp: { notIn: empresaIds } },
      data: { unidadNegocioId: null },
    }),
    prisma.empresa.updateMany({
      where: { codEmp: { in: empresaIds } },
      data: { unidadNegocioId: codUnidad },
    }),
  ]);

  revalidatePath("/configuracion/unidades-negocio");
  revalidatePath("/configuracion/empresas");
}
