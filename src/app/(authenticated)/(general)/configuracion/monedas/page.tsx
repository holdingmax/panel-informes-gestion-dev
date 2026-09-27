import { listMonedas, createMoneda } from "@/lib/moneda-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { MonedaRow } from "./MonedaRow";

export const dynamic = "force-dynamic";

export default async function MonedasPage() {
  const monedas = await listMonedas();

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Monedas</h1>

      <CollapsibleAdd>
        <form action={createMoneda} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-lg">Nombre</span>
            <input
              name="nomMoneda"
              required
              maxLength={60}
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-lg">Símbolo</span>
            <input
              name="simbolo"
              required
              maxLength={5}
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
              <th className="py-1">Símbolo</th>
              <th className="py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {monedas.map((moneda) => (
              <MonedaRow
                key={moneda.codMoneda}
                codMoneda={moneda.codMoneda}
                nomMoneda={moneda.nomMoneda}
                simbolo={moneda.simbolo}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
