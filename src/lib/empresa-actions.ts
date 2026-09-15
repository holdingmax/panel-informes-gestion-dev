"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function listEmpresas() {
  return prisma.empresa.findMany({
    orderBy: { nombreEmp: "asc" },
    include: { unidadNegocio: { select: { codUnidad: true, nombreUnidad: true } } },
  });
}

export async function listEmpresasDeUnidad(unidadNegocioId: number) {
  return prisma.empresa.findMany({
    where: { unidadNegocioId },
    orderBy: { nombreEmp: "asc" },
  });
}

export async function getEmpresa(codEmp: number) {
  return prisma.empresa.findUnique({ where: { codEmp } });
}

export async function createEmpresa(formData: FormData) {
  const nombreEmp = String(formData.get("nombreEmp") ?? "").trim();
  if (!nombreEmp) throw new Error("El nombre es obligatorio");
  if (nombreEmp.length > 60) throw new Error("El nombre no puede superar 60 caracteres");

  await prisma.empresa.create({ data: { nombreEmp } });

  revalidatePath("/configuracion/empresas");
}
