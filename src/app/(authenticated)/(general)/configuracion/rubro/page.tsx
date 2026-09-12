import { listRubrosConClasificacion } from "@/lib/rubro-actions";
import { createCatalogItem } from "@/lib/catalog-actions";
import { RubroClasificacionRow } from "./RubroClasificacionRow";

export const dynamic = "force-dynamic";

export default async function RubroPage() {
  const rubros = await listRubrosConClasificacion();

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Rubro</h1>

      <p className="text-sm text-zinc-600">
        Origen/Aplicación se usa para armar el informe de Balance y Origen y Aplicación de
        Fondos de cada empresa. La clasificación de Necesidades Operativas de Fondos (NOF) se
        hace por cuenta en Configuración → Categoría OyA, no acá.
      </p>

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Nombre</th>
              <th className="py-1 pr-4">Origen / Aplicación</th>
            </tr>
          </thead>
          <tbody>
            {rubros.map((rubro) => (
              <RubroClasificacionRow
                key={rubro.codRubro}
                codRubro={rubro.codRubro}
                nomRubro={rubro.nomRubro}
                categoriaOyA={rubro.categoriaOyA}
              />
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={createCatalogItem}
        className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow"
      >
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
    </main>
  );
}
