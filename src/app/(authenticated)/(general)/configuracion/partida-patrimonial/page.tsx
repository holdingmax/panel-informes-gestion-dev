import { listPartidasConClasificacion } from "@/lib/partida-actions";
import { createCatalogItem } from "@/lib/catalog-actions";
import { PartidaTipoRow } from "./PartidaTipoRow";

export const dynamic = "force-dynamic";

export default async function PartidaPatrimonialPage() {
  const partidas = await listPartidasConClasificacion();

  return (
    <main className="flex w-full max-w-2xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Partida Patrimonial</h1>

      <p className="text-sm text-zinc-600">
        El &quot;Tipo&quot; indica si la partida forma parte del Balance (Activo/Pasivo/Patrimonio Neto)
        o del Resultado del período (Ingresos/Egresos). Se usa para armar el informe de Balance
        de cada empresa.
      </p>

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Nombre</th>
              <th className="py-1 pr-4">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {partidas.map((partida) => (
              <PartidaTipoRow
                key={partida.codPartida}
                codPartida={partida.codPartida}
                nomPartida={partida.nomPartida}
                tipo={partida.tipo}
              />
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={createCatalogItem}
        className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow"
      >
        <input type="hidden" name="tabla" value="partida-patrimonial" />
        <label className="flex flex-col gap-1">
          <span className="text-lg">Nombre de partida</span>
          <input name="nombre" required maxLength={40} className="rounded border px-3 py-2 text-lg" />
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
