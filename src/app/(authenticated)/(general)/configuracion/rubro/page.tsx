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
        Origen/Aplicación y el agrupamiento de Necesidades Operativas de Fondos (NOF) se usan
        para armar el informe de Balance y Origen y Aplicación de Fondos de cada empresa.
      </p>

      <table className="w-full text-left text-lg">
        <thead>
          <tr>
            <th className="py-1 pr-4">Código</th>
            <th className="py-1 pr-4">Nombre</th>
            <th className="py-1 pr-4">Origen / Aplicación</th>
            <th className="py-1 pr-4">Bucket NOF</th>
          </tr>
        </thead>
        <tbody>
          {rubros.map((rubro) => (
            <RubroClasificacionRow
              key={rubro.codRubro}
              codRubro={rubro.codRubro}
              nomRubro={rubro.nomRubro}
              categoriaOyA={rubro.categoriaOyA}
              bucketNOF={rubro.bucketNOF}
            />
          ))}
        </tbody>
      </table>

      <form action={createCatalogItem} className="flex flex-col gap-3">
        <input type="hidden" name="tabla" value="rubro" />
        <label className="flex flex-col gap-1">
          <span className="text-lg">Nombre de rubro</span>
          <input name="nombre" required maxLength={60} className="rounded border px-3 py-2 text-lg" />
        </label>
        <button type="submit" className="w-fit rounded bg-black px-3 py-2 text-lg text-white">
          Agregar
        </button>
      </form>
    </main>
  );
}
