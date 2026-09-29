import { auth } from "@/auth";

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
