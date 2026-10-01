import { auth } from "@/auth";
import { listSubrubrosConClasificacion } from "@/lib/subrubro-actions";
import { createCatalogItem } from "@/lib/catalog-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { SubrubroCampoRow } from "./SubrubroCampoRow";

export const dynamic = "force-dynamic";

export default async function SubrubroPage() {
  const subrubros = await listSubrubrosConClasificacion();
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Subrubro</h1>

      <p className="text-sm text-zinc-600">
        Exclusivo de cuentas de Rubros de Partida Resultado (Ingresos/Egresos) — el Campo del ER
        decide a cuál de los 5 campos del cuadro Nominal del Estado de Resultados aporta cada
        cuenta. Para el resto de los rubros, usá Subrubro 2 / Subrubro 3 como ayuda visual.
      </p>

      {isAdmin && (
        <CollapsibleAdd>
          <form action={createCatalogItem} className="flex flex-col gap-3">
            <input type="hidden" name="tabla" value="subrubro" />
            <label className="flex flex-col gap-1">
              <span className="text-lg">Nombre de subrubro</span>
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
              <th className="py-1 pr-4">Campo del ER</th>
              <th className="py-1 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {subrubros.map((subrubro) => (
              <SubrubroCampoRow
                key={subrubro.codSubrubro}
                codSubrubro={subrubro.codSubrubro}
                nomSubrubro={subrubro.nomSubrubro}
                campoResultado={subrubro.campoResultado}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
