import { listCategoriasOyAConClasificacion } from "@/lib/categoria-oya-actions";
import { createCatalogItem } from "@/lib/catalog-actions";
import { CategoriaOyABucketRow } from "./CategoriaOyABucketRow";

export const dynamic = "force-dynamic";

export default async function CategoriaOyAPage() {
  const categorias = await listCategoriasOyAConClasificacion();

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Categoría OyA</h1>

      <p className="text-sm text-zinc-600">
        Se asigna por cuenta en el Plan de Cuentas (dos cuentas de un mismo Rubro pueden tener
        categorías distintas). El agrupamiento NOF de cada categoría se usa para armar la hoja de
        Necesidades Operativas de Fondos del informe.
      </p>

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Nombre</th>
              <th className="py-1 pr-4">Agrupamiento NOF</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((categoria) => (
              <CategoriaOyABucketRow
                key={categoria.codOyA}
                codOyA={categoria.codOyA}
                nomOyA={categoria.nomOyA}
                bucketNOF={categoria.bucketNOF}
              />
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={createCatalogItem}
        className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow"
      >
        <input type="hidden" name="tabla" value="categoria-oya" />
        <label className="flex flex-col gap-1">
          <span className="text-lg">Nombre de categoría OyA</span>
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
