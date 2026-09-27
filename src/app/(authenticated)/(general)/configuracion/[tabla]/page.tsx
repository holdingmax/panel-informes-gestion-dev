import { notFound } from "next/navigation";
import { CATALOGS, CATALOG_ROUTES } from "@/lib/catalogs";
import { listCatalog, createCatalogItem } from "@/lib/catalog-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { CatalogRow } from "./CatalogRow";

export const dynamic = "force-dynamic";

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ tabla: string }>;
}) {
  const { tabla } = await params;
  const route = CATALOG_ROUTES[tabla];
  if (!route) notFound();

  const { codeField, nameField } = CATALOGS[route.key];
  const items: Record<string, unknown>[] = await listCatalog(route.key);

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">{route.title}</h1>

      <CollapsibleAdd>
        <form action={createCatalogItem} className="flex flex-col gap-3">
          <input type="hidden" name="tabla" value={tabla} />
          <label className="flex flex-col gap-1">
            <span className="text-lg">{route.fieldLabel}</span>
            <input
              name="nombre"
              required
              maxLength={60}
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Agregar
          </button>
        </form>
      </CollapsibleAdd>

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1">Código</th>
              <th className="py-1">Nombre</th>
              <th className="py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <CatalogRow
                key={String(item[codeField])}
                catalogKey={route.key}
                codigo={Number(item[codeField])}
                nombre={String(item[nameField])}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
