import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Sin "use server": son funciones auxiliares que se llaman DESDE server
// actions, no acciones en sí — lanzan, no devuelven un resultado que el
// cliente tenga que interpretar.
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("No autenticado");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return session;
}

export type PermisoUnidad = "configuracion" | "revisar" | "aprobar" | "adjuntar";

const CAMPO_PERMISO = {
  configuracion: "puedeConfiguracion",
  revisar: "puedeRevisar",
  aprobar: "puedeAprobar",
  adjuntar: "puedeAdjuntar",
} as const;

// ADMIN pasa siempre, igual que requireAdmin() — ve y puede todo en
// cualquier Unidad de Negocio. Un USER necesita una fila en
// UserUnidadPermiso para esa unidad puntual, o una fila "para todas las
// unidades" (unidadNegocioId null) — sin `permiso` alcanza con que la fila
// exista (acceso de lectura/navegación); pidiendo un `permiso` puntual,
// además tiene que estar en true en esa fila.
export async function requireAccesoUnidad(unidadNegocioId: number, permiso?: PermisoUnidad) {
  const session = await requireUser();
  if (session.user.role === "ADMIN") return session;

  const filas = await prisma.userUnidadPermiso.findMany({
    where: { userId: session.user.id, OR: [{ unidadNegocioId }, { unidadNegocioId: null }] },
  });
  if (filas.length === 0) {
    throw new Error("No tenés acceso a esta unidad de negocio.");
  }
  if (permiso && !filas.some((f) => f[CAMPO_PERMISO[permiso]])) {
    throw new Error("No tenés el permiso necesario para esta acción en esta unidad de negocio.");
  }
  return session;
}

export type PermisosUnidad = {
  puedeConfiguracion: boolean;
  puedeRevisar: boolean;
  puedeAprobar: boolean;
  puedeAdjuntar: boolean;
};

// Para decidir qué botones mostrar en la UI (Revisar/Aprobar/Adjuntar) sin
// repetir el mismo findMany de requireAccesoUnidad en cada pantalla. ADMIN
// tiene los cuatro en true; un USER puede tener más de una fila que aplique
// (una por esta unidad puntual y/o una "para todas las unidades") — alcanza
// con que una de ellas tenga el permiso en true.
export async function permisosDeUnidad(unidadNegocioId: number): Promise<PermisosUnidad> {
  const session = await requireUser();
  if (session.user.role === "ADMIN") {
    return { puedeConfiguracion: true, puedeRevisar: true, puedeAprobar: true, puedeAdjuntar: true };
  }

  const filas = await prisma.userUnidadPermiso.findMany({
    where: { userId: session.user.id, OR: [{ unidadNegocioId }, { unidadNegocioId: null }] },
  });
  return {
    puedeConfiguracion: filas.some((f) => f.puedeConfiguracion),
    puedeRevisar: filas.some((f) => f.puedeRevisar),
    puedeAprobar: filas.some((f) => f.puedeAprobar),
    puedeAdjuntar: filas.some((f) => f.puedeAdjuntar),
  };
}

// Atajo para las pantallas de detalle/drill-down del informe, que solo
// tienen a mano el informeId (no la unidad) — resuelve la unidad dueña y
// delega en permisosDeUnidad.
export async function permisosDeInforme(informeId: string): Promise<PermisosUnidad> {
  const informe = await prisma.informe.findUniqueOrThrow({
    where: { id: informeId },
    select: { unidadNegocioId: true },
  });
  return permisosDeUnidad(informe.unidadNegocioId);
}

// "todas" = sin restricción (ADMIN, o un USER con un permiso "para todas
// las unidades" cargado) — para filtrar grids de unidades (preparación de
// informes, consulta) sin tener que resolver unidad por unidad.
export async function unidadesAccesibles(): Promise<"todas" | number[]> {
  const session = await requireUser();
  if (session.user.role === "ADMIN") return "todas";

  const filas = await prisma.userUnidadPermiso.findMany({
    where: { userId: session.user.id },
    select: { unidadNegocioId: true },
  });
  if (filas.some((f) => f.unidadNegocioId === null)) return "todas";
  return filas
    .map((f) => f.unidadNegocioId)
    .filter((id): id is number => id !== null);
}
