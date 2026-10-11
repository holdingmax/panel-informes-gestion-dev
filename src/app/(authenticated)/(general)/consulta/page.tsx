import { listUnidadesNegocio } from "@/lib/unidad-negocio-actions";
import { unidadesAccesibles } from "@/lib/authz";
import { UnidadNegocioGrid } from "../../../UnidadNegocioGrid";

export const dynamic = "force-dynamic";

export default async function ConsultaPage() {
  const [todasLasUnidades, accesibles] = await Promise.all([
    listUnidadesNegocio(),
    unidadesAccesibles("consulta"),
  ]);
  const unidades =
    accesibles === "todas"
      ? todasLasUnidades
      : todasLasUnidades.filter((u) => accesibles.includes(u.codUnidad));

  return (
    <main className="flex w-full flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Consulta</h1>
      <p className="text-lg text-zinc-600">
        Elegí una unidad de negocio para ver el histórico completo de sus informes.
      </p>

      <UnidadNegocioGrid
        unidades={unidades}
        basePath="/consulta"
        sinAcceso={todasLasUnidades.length > 0}
      />
    </main>
  );
}
