"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

const SELECT_PERMISOS = {
  unidadNegocioId: true,
  puedeConsultar: true,
  puedeRevisar: true,
  puedeAprobar: true,
  puedeAdjuntar: true,
  puedeConfeccionar: true,
  puedeConfiguracion: true,
  puedeReclasificar: true,
  puedeEliminar: true,
} as const;

export async function listPermisosDeUsuario(userId: string) {
  await requireAdmin();
  return prisma.userUnidadPermiso.findMany({ where: { userId }, select: SELECT_PERMISOS });
}

// Dos árboles independientes (ver UserUnidadPermiso): Consulta y Confección.
export type PermisoInput = {
  puedeConsultar: boolean;
  puedeRevisar: boolean;
  puedeAprobar: boolean;
  puedeAdjuntar: boolean;
  puedeConfeccionar: boolean;
  puedeConfiguracion: boolean;
  puedeReclasificar: boolean;
  puedeEliminar: boolean;
};

// unidadNegocioId null = fila "todas las unidades". No se puede usar un
// upsert con la unique compuesta (userId, unidadNegocioId) para ese caso
// porque Prisma no admite null en el filtro de una unique compuesta
// (NULL no es comparable por igualdad en SQL) — se resuelve a mano con
// findFirst + create/update/delete.
export async function setPermisoUnidad(
  userId: string,
  unidadNegocioId: number | null,
  permiso: PermisoInput
) {
  await requireAdmin();

  // Los hijos de cada árbol solo valen con el acceso de su ventana: se fuerza
  // acá y no solo en la UI.
  const data: PermisoInput = {
    puedeConsultar: permiso.puedeConsultar,
    puedeRevisar: permiso.puedeConsultar && permiso.puedeRevisar,
    puedeAprobar: permiso.puedeConsultar && permiso.puedeAprobar,
    puedeAdjuntar: permiso.puedeConsultar && permiso.puedeAdjuntar,
    puedeConfeccionar: permiso.puedeConfeccionar,
    puedeConfiguracion: permiso.puedeConfeccionar && permiso.puedeConfiguracion,
    puedeReclasificar: permiso.puedeConfeccionar && permiso.puedeReclasificar,
    puedeEliminar: permiso.puedeConfeccionar && permiso.puedeEliminar,
  };

  const existente = await prisma.userUnidadPermiso.findFirst({
    where: { userId, unidadNegocioId },
    select: { id: true },
  });

  if (!data.puedeConsultar && !data.puedeConfeccionar) {
    if (existente) {
      await prisma.userUnidadPermiso.delete({ where: { id: existente.id } });
    }
  } else if (existente) {
    await prisma.userUnidadPermiso.update({ where: { id: existente.id }, data });
  } else {
    await prisma.userUnidadPermiso.create({ data: { userId, unidadNegocioId, ...data } });
  }

  revalidatePath("/admin/users");
}
