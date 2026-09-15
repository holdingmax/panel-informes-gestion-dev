import { auth } from "@/auth";
import { listUnidadesNegocio } from "@/lib/unidad-negocio-actions";
import { UnidadNegocioGrid } from "../../UnidadNegocioGrid";

export default async function Home() {
  const session = await auth();
  const unidades = await listUnidadesNegocio();

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
