import { auth } from "@/auth";
import { listRubrosConClasificacion } from "@/lib/rubro-actions";
import { listPartidasConClasificacion } from "@/lib/partida-actions";
import { createCatalogItem } from "@/lib/catalog-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { RubroClasificacionRow } from "./RubroClasificacionRow";

export const dynamic = "force-dynamic";

export default async function RubroPage() {
  const [rubros, partidas] = await Promise.all([
    listRubrosConClasificacion(),
    listPartidasConClasificacion(),
  ]);
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Rubro</h1>

      <p className="text-sm text-zinc-600">
        La Partida Patrimonial decide dónde cae este Rubro en el Estado de Situación Patrimonial
        (Activo/Pasivo/Patrimonio Neto) o si es de Resultado — uniforma la clasificación para
        todas las cuentas que use este Rubro. La clasificación CTO/ONP/ARS de Necesidades
        Operativas de Fondos (NOF) se elige en el ESP de cada informe, por unidad de negocio, no acá.
      </p>

      {isAdmin && (
        <CollapsibleAdd>
          <form action={createCatalogItem} className="flex flex-col gap-3">
            <input type="hidden" name="tabla" value="rubro" />
            <label className="flex flex-col gap-1">
              <span className="text-lg">Nombre de rubro</span>
              <input name="nombre" required maxLength={60} className="rounded border px-3 py-2 text-lg" />
            </label>
            <button
              type="submit"
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Agregar
            </button>
          </form>
        </CollapsibleAdd>
      )}

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Nombre</th>
              <th className="py-1 pr-4">Partida Patrimonial</th>
              <th className="py-1 pr-4">Orden en el ESP</th>
              <th className="py-1 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rubros.map((rubro) => (
              <RubroClasificacionRow
                key={rubro.codRubro}
                codRubro={rubro.codRubro}
                nomRubro={rubro.nomRubro}
                partidaPatrimonialId={rubro.partidaPatrimonialId}
                partidas={partidas}
                orden={rubro.orden}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
