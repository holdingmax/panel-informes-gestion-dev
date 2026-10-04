import { auth } from "@/auth";
import { listUnidadesNegocio } from "@/lib/unidad-negocio-actions";
import { unidadesAccesibles } from "@/lib/authz";
import { UnidadNegocioGrid } from "../../../UnidadNegocioGrid";

export const dynamic = "force-dynamic";

export default async function PreparacionInformesPage() {
  const session = await auth();
  const [todasLasUnidades, accesibles] = await Promise.all([
    listUnidadesNegocio(),
    unidadesAccesibles(),
  ]);
  const unidades =
    accesibles === "todas"
      ? todasLasUnidades
      : todasLasUnidades.filter((u) => accesibles.includes(u.codUnidad));

  return (
    <main className="flex w-full flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">
        Sistema de Confección de Informes de Gestión
      </h1>

      <p className="text-lg text-zinc-600">
        Sesión iniciada como <strong>{session?.user.name}</strong> (
        {session?.user.role})
      </p>

      <UnidadNegocioGrid unidades={unidades} />
    </main>
  );
}
