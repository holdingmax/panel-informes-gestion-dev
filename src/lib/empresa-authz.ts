import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAccesoUnidad } from "@/lib/authz";

// Sin "use server": helpers que se llaman DESDE server actions. La Empresa es
// el recurso, pero los permisos se conceden por Unidad de Negocio (ver
// UserUnidadPermiso) y una Empresa puede estar en más de una Unidad (cuando
// comparte BSyS) — alcanza con tener el permiso en alguna de ellas. Una
// Empresa sin vincular todavía a ninguna Unidad solo la toca un ADMIN.
export async function unidadIdsDeEmpresa(codEmp: number): Promise<number[]> {
  const filas = await prisma.empresaUnidad.findMany({
    where: { empresaId: codEmp },
    select: { unidadNegocioId: true },
  });
  return filas.map((f) => f.unidadNegocioId);
}

async function requireEnAlgunaUnidad(
  unidadIds: number[],
  permiso: "configuracion" | undefined
) {
  let ultimoError: unknown = new Error("No tenés acceso a esta empresa.");
  for (const unidadId of unidadIds) {
    try {
      await requireAccesoUnidad(unidadId, permiso);
      return;
    } catch (e) {
      ultimoError = e;
    }
  }
  throw ultimoError;
}

export async function requireAccesoConfiguracionEmpresa(codEmp: number) {
  // Falla si la empresa no existe, igual que antes.
  await prisma.empresa.findUniqueOrThrow({ where: { codEmp }, select: { codEmp: true } });
  const unidadIds = await unidadIdsDeEmpresa(codEmp);
  if (unidadIds.length === 0) {
    await requireAdmin();
    return;
  }
  await requireEnAlgunaUnidad(unidadIds, "configuracion");
}

// Lectura: alcanza con tener acceso a alguna de las Unidades de la Empresa.
export async function requireAccesoEmpresa(codEmp: number) {
  const unidadIds = await unidadIdsDeEmpresa(codEmp);
  if (unidadIds.length === 0) {
    await requireAdmin();
    return;
  }
  await requireEnAlgunaUnidad(unidadIds, undefined);
}
