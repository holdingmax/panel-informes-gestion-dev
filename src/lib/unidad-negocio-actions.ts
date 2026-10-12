"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { DeleteCheckResult } from "@/components/ConfirmDeleteButton";
import { requireUser, requireAdmin, requireAccesoUnidad, unidadesAccesibles } from "@/lib/authz";

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
  const accesibles = await unidadesAccesibles("cualquiera");
  const unidades = await prisma.unidadNegocio.findMany({
    where: accesibles === "todas" ? undefined : { codUnidad: { in: accesibles } },
    orderBy: { codUnidad: "asc" },
    include: { empresas: { select: { empresa: true } } },
  });
  // Mismo formato de siempre: la lista de Empresas de cada Unidad, por nombre.
  return unidades.map((u) => ({
    ...u,
    empresas: u.empresas
      .map((vinculo) => vinculo.empresa)
      .sort((a, b) => a.nombreEmp.localeCompare(b.nombreEmp)),
  }));
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
  await requireAccesoUnidad(codUnidad, "configuracion");
  const value = nombreUnidad.trim();
  if (!value) throw new Error("El nombre es obligatorio");
  if (value.length > 35) throw new Error("El nombre no puede superar 35 caracteres");

  await prisma.unidadNegocio.update({ where: { codUnidad }, data: { nombreUnidad: value } });
  revalidatePath("/configuracion/unidades-negocio");
  revalidatePath("/preparacion-informes");
}

export async function updateUnidadNegocioLogo(formData: FormData) {
  const codUnidad = Number(formData.get("codUnidad"));
  await requireAccesoUnidad(codUnidad, "configuracion");
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
  const [empresas, informes, historicos, cuentas, cargas] = await Promise.all([
    prisma.empresaUnidad.count({ where: { unidadNegocioId: codUnidad } }),
    prisma.informe.count({ where: { unidadNegocioId: codUnidad } }),
    prisma.resultadosHistoricos.count({ where: { unidadNegocioId: codUnidad } }),
    prisma.planDeCuentas.count({ where: { unidadNegocioId: codUnidad } }),
    prisma.balanceSumasYSaldos.count({ where: { unidadNegocioId: codUnidad } }),
  ]);

  const motivos: string[] = [];
  if (empresas > 0) motivos.push(`${empresas} empresa(s) vinculada(s)`);
  if (cuentas > 0) motivos.push(`${cuentas} cuenta(s) del Plan de Cuentas asignadas a esta unidad`);
  if (cargas > 0) motivos.push(`${cargas} fila(s) de BSyS cargadas por esta unidad`);
  if (informes > 0) motivos.push(`${informes} informe(s)`);
  if (historicos > 0) motivos.push(`${historicos} período(s) de Resultados Históricos`);

  if (motivos.length === 0) return { blocked: false };
  return { blocked: true, reason: `No se puede eliminar: tiene ${motivos.join(", ")}.` };
}

export async function deleteUnidadNegocio(codUnidad: number) {
  await requireAccesoUnidad(codUnidad, "configuracion");
  const check = await checkDeleteUnidadNegocio(codUnidad);
  if (check.blocked) throw new Error(check.reason);

  await prisma.unidadNegocio.delete({ where: { codUnidad } });
  revalidatePath("/configuracion/unidades-negocio");
  revalidatePath("/preparacion-informes");
}

// Reemplaza por completo el conjunto de Empresas vinculadas a esta Unidad de
// Negocio (lo que llega del <select multiple> del formulario). Una Empresa
// que NO comparte BSyS solo puede estar en una Unidad a la vez, así que
// elegirla acá se la saca de donde estuviera antes (llevándose consigo los
// BSyS ya cargados). Una que sí comparte BSyS se suma a esta Unidad sin
// salir de las otras; para desvincularla de esta Unidad, ninguna de sus
// cuentas puede seguir asignada a ella.
export async function actualizarEmpresasVinculadas(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const codUnidad = Number(formData.get("codUnidad"));
  await requireAccesoUnidad(codUnidad, "configuracion");
  const empresaIds = formData.getAll("empresaIds").map(Number).filter(Number.isFinite);

  const [vinculadas, elegidas] = await Promise.all([
    prisma.empresaUnidad.findMany({
      where: { unidadNegocioId: codUnidad },
      select: { empresaId: true, empresa: { select: { nombreEmp: true, comparteBsys: true } } },
    }),
    prisma.empresa.findMany({
      where: { codEmp: { in: empresaIds } },
      select: { codEmp: true, comparteBsys: true, unidades: { select: { unidadNegocioId: true } } },
    }),
  ]);

  const aSacar = vinculadas.filter((v) => !empresaIds.includes(v.empresaId));
  for (const v of aSacar) {
    if (!v.empresa.comparteBsys) continue;
    const cuentas = await prisma.planDeCuentas.count({
      where: { empresaId: v.empresaId, unidadNegocioId: codUnidad },
    });
    if (cuentas > 0) {
      return {
        error: `No se puede desvincular "${v.empresa.nombreEmp}": tiene ${cuentas} cuenta(s) asignadas a esta unidad. Reasignalas primero en Configuración → Plan de Cuentas.`,
      };
    }
  }

  const yaVinculadas = new Set(vinculadas.map((v) => v.empresaId));
  const operaciones: Prisma.PrismaPromise<unknown>[] = [
    prisma.empresaUnidad.deleteMany({
      where: { unidadNegocioId: codUnidad, empresaId: { notIn: empresaIds } },
    }),
  ];
  for (const e of elegidas) {
    if (yaVinculadas.has(e.codEmp)) continue;
    const otras = e.unidades.map((u) => u.unidadNegocioId).filter((id) => id !== codUnidad);
    if (!e.comparteBsys && otras.length > 0) {
      // Se muda de Unidad: se va de la anterior y sus BSyS se mudan con ella.
      operaciones.push(
        prisma.empresaUnidad.deleteMany({ where: { empresaId: e.codEmp, unidadNegocioId: { in: otras } } }),
        prisma.balanceSumasYSaldos.updateMany({
          where: { empresaId: e.codEmp, unidadNegocioId: { in: otras } },
          data: { unidadNegocioId: codUnidad },
        })
      );
    }
    operaciones.push(
      prisma.empresaUnidad.create({ data: { empresaId: e.codEmp, unidadNegocioId: codUnidad } })
    );
  }
  await prisma.$transaction(operaciones);

  revalidatePath("/configuracion/unidades-negocio");
  revalidatePath("/configuracion/empresas");
}
