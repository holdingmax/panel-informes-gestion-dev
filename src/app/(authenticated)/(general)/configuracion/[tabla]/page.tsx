import { notFound } from "next/navigation";
import { CATALOGS, CATALOG_ROUTES } from "@/lib/catalogs";
import { listCatalog, createCatalogItem } from "@/lib/catalog-actions";

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
    <main className="flex w-full max-w-xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">{route.title}</h1>

      <table className="w-full text-left text-lg">
        <thead>
          <tr>
            <th className="py-1">Código</th>
            <th className="py-1">Nombre</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={String(item[codeField])} className="border-t">
              <td className="py-2">{String(item[codeField])}</td>
              <td className="py-2">{String(item[nameField])}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
        <button type="submit" className="rounded bg-black px-3 py-2 text-lg text-white">
          Agregar
        </button>
      </form>
    </main>
  );
}
