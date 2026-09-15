"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export async function listUnidadesNegocio() {
  return prisma.unidadNegocio.findMany({
    orderBy: { nombreUnidad: "asc" },
    select: { codUnidad: true, nombreUnidad: true, imagenMime: true },
  });
}

export async function listUnidadesNegocioConEmpresas() {
  return prisma.unidadNegocio.findMany({
    orderBy: { nombreUnidad: "asc" },
    include: { empresas: { orderBy: { nombreEmp: "asc" } } },
  });
}

export async function getUnidadNegocio(codUnidad: number) {
  return prisma.unidadNegocio.findUnique({ where: { codUnidad } });
}

export async function createUnidadNegocio(formData: FormData) {
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
  revalidatePath("/");
}

// Reemplaza por completo el conjunto de Empresas vinculadas a esta Unidad de
// Negocio (lo que llega del <select multiple> del formulario). Una Empresa
// solo puede estar vinculada a una Unidad de Negocio a la vez, así que
// elegirla acá se la saca de donde estuviera antes.
export async function actualizarEmpresasVinculadas(formData: FormData) {
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
