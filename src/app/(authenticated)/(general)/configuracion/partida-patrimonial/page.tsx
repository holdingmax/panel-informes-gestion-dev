import Link from "next/link";
import { auth } from "@/auth";
import { listPartidasConClasificacion } from "@/lib/partida-actions";
import { listTiposPartida } from "@/lib/tipo-partida-actions";
import { createCatalogItem } from "@/lib/catalog-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { PartidaTipoRow } from "./PartidaTipoRow";

export const dynamic = "force-dynamic";

export default async function PartidaPatrimonialPage() {
  const [partidas, tipos] = await Promise.all([listPartidasConClasificacion(), listTiposPartida()]);
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Partida Patrimonial</h1>

      <p className="text-sm text-zinc-600">
        El &quot;Tipo&quot; indica si la partida forma parte del Balance (Activo/Pasivo/Patrimonio Neto)
        o del Resultado del período (Ingresos/Egresos). Se usa para armar el informe de Balance
        de cada empresa. Los valores posibles de Tipo se administran en{" "}
        <Link href="/configuracion/tipo-partida" className="underline hover:text-accent">
          Configuración → Tipo de Partida
        </Link>
        .
      </p>

      {isAdmin && (
        <CollapsibleAdd>
          <form action={createCatalogItem} className="flex flex-col gap-3">
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
        </CollapsibleAdd>
      )}

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Nombre</th>
              <th className="py-1 pr-4">Tipo</th>
              <th className="py-1 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {partidas.map((partida) => (
              <PartidaTipoRow
                key={partida.codPartida}
                codPartida={partida.codPartida}
                nomPartida={partida.nomPartida}
                tipoId={partida.tipoId}
                tipos={tipos}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
