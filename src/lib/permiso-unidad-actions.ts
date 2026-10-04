"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export async function listPermisosDeUsuario(userId: string) {
  await requireAdmin();
  return prisma.userUnidadPermiso.findMany({
    where: { userId },
    select: {
      unidadNegocioId: true,
      puedeConfiguracion: true,
      puedeRevisar: true,
      puedeAprobar: true,
      puedeAdjuntar: true,
    },
  });
}

export type PermisoInput = {
  acceso: boolean;
  puedeConfiguracion: boolean;
  puedeRevisar: boolean;
  puedeAprobar: boolean;
  puedeAdjuntar: boolean;
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

  const existente = await prisma.userUnidadPermiso.findFirst({
    where: { userId, unidadNegocioId },
    select: { id: true },
  });

  if (!permiso.acceso) {
    if (existente) {
      await prisma.userUnidadPermiso.delete({ where: { id: existente.id } });
    }
  } else {
    const data = {
      puedeConfiguracion: permiso.puedeConfiguracion,
      puedeRevisar: permiso.puedeRevisar,
      puedeAprobar: permiso.puedeAprobar,
      puedeAdjuntar: permiso.puedeAdjuntar,
    };
    if (existente) {
      await prisma.userUnidadPermiso.update({ where: { id: existente.id }, data });
    } else {
      await prisma.userUnidadPermiso.create({ data: { userId, unidadNegocioId, ...data } });
    }
  }

  revalidatePath("/admin/users");
}
