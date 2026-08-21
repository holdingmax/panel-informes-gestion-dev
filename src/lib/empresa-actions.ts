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

export async function listEmpresas() {
  return prisma.empresa.findMany({
    orderBy: { nombreEmp: "asc" },
    select: { codEmp: true, nombreEmp: true, imagenMime: true },
  });
}

export async function getEmpresa(codEmp: number) {
  return prisma.empresa.findUnique({ where: { codEmp } });
}

export async function createEmpresa(formData: FormData) {
  const nombreEmp = String(formData.get("nombreEmp") ?? "").trim();
  if (!nombreEmp) throw new Error("El nombre es obligatorio");
  if (nombreEmp.length > 35) throw new Error("El nombre no puede superar 35 caracteres");

  const file = formData.get("imagen");
  let imagenEmp: Uint8Array<ArrayBuffer> | undefined;
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
    imagenEmp = new Uint8Array(await file.arrayBuffer());
    imagenMime = file.type;
  }

  await prisma.empresa.create({
    data: { nombreEmp, imagenEmp, imagenMime },
  });

  revalidatePath("/configuracion/empresas");
  revalidatePath("/");
}
