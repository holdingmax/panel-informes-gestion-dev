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

  // El JWT guarda `active` y `role` solo del momento del login: se vuelven a
  // leer acá para que desactivar a un usuario o cambiarle el rol rija ya, sin
  // esperar a que venza su sesión.
  const actual = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, role: true },
  });
  if (!actual || !actual.active) {
    throw new Error("No autenticado");
  }
  session.user.role = actual.role;
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  return session;
}

export type PermisoUnidad =
  | "consultar"
  | "revisar"
  | "aprobar"
  | "adjuntar"
  | "confeccionar"
  | "configuracion"
  | "reclasificar"
  | "eliminar";

const CAMPO_PERMISO = {
  consultar: "puedeConsultar",
  revisar: "puedeRevisar",
  aprobar: "puedeAprobar",
  adjuntar: "puedeAdjuntar",
  confeccionar: "puedeConfeccionar",
  configuracion: "puedeConfiguracion",
  reclasificar: "puedeReclasificar",
  eliminar: "puedeEliminar",
} as const;

export type PermisosUnidad = {
  [K in (typeof CAMPO_PERMISO)[PermisoUnidad]]: boolean;
};

const TODOS_LOS_PERMISOS: PermisosUnidad = {
  puedeConsultar: true,
  puedeRevisar: true,
  puedeAprobar: true,
  puedeAdjuntar: true,
  puedeConfeccionar: true,
  puedeConfiguracion: true,
  puedeReclasificar: true,
  puedeEliminar: true,
};

async function filasDeUnidad(userId: string, unidadNegocioId: number) {
  return prisma.userUnidadPermiso.findMany({
    where: { userId, OR: [{ unidadNegocioId }, { unidadNegocioId: null }] },
  });
}

// ADMIN pasa siempre, igual que requireAdmin() — ve y puede todo en
// cualquier Unidad de Negocio. Un USER puede tener más de una fila que
// aplique (una por esta unidad puntual y/o una "para todas las unidades"):
// alcanza con que una de ellas tenga el permiso en true. Sin `permiso` alcanza
// con tener acceso a alguna de las dos ventanas (consultar o confeccionar) —
// es el piso para entrar a la unidad (layout de /empresa, adjuntos, PDF).
export async function requireAccesoUnidad(unidadNegocioId: number, permiso?: PermisoUnidad) {
  const session = await requireUser();
  if (session.user.role === "ADMIN") return session;

  const filas = await filasDeUnidad(session.user.id, unidadNegocioId);
  if (!filas.some((f) => f.puedeConsultar || f.puedeConfeccionar)) {
    throw new Error("No tenés acceso a esta unidad de negocio.");
  }
  if (permiso && !filas.some((f) => f[CAMPO_PERMISO[permiso]])) {
    throw new Error("No tenés el permiso necesario para esta acción en esta unidad de negocio.");
  }
  return session;
}

// Para decidir qué botones mostrar en la UI sin repetir el mismo findMany de
// requireAccesoUnidad en cada pantalla. ADMIN tiene todos en true.
export async function permisosDeUnidad(unidadNegocioId: number): Promise<PermisosUnidad> {
  const session = await requireUser();
  if (session.user.role === "ADMIN") return TODOS_LOS_PERMISOS;

  const filas = await filasDeUnidad(session.user.id, unidadNegocioId);
  return Object.fromEntries(
    Object.values(CAMPO_PERMISO).map((campo) => [campo, filas.some((f) => f[campo])])
  ) as PermisosUnidad;
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
// las unidades" cargado) — para filtrar grids de unidades de cada ventana
// (consulta, preparación de informes) sin resolver unidad por unidad.
export async function unidadesAccesibles(
  ventana: "consulta" | "confeccion"
): Promise<"todas" | number[]> {
  const session = await requireUser();
  if (session.user.role === "ADMIN") return "todas";

  const campo = ventana === "consulta" ? "puedeConsultar" : "puedeConfeccionar";
  const filas = await prisma.userUnidadPermiso.findMany({
    where: { userId: session.user.id, [campo]: true },
    select: { unidadNegocioId: true },
  });
  if (filas.some((f) => f.unidadNegocioId === null)) return "todas";
  return filas
    .map((f) => f.unidadNegocioId)
    .filter((id): id is number => id !== null);
}
