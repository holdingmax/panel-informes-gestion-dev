import { listSeriesEIndicesTablas, createSeriesEIndicesTabla } from "@/lib/series-e-indices-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { SeriesTablaRow } from "./SeriesTablaRow";

export const dynamic = "force-dynamic";

export default async function SeriesEIndicesPage() {
  const tablas = await listSeriesEIndicesTablas();

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Series e Índices</h1>

      <p className="text-sm text-zinc-600">
        Cada tabla es una serie mensual y correlativa (sin huecos) de índice de inflación y
        dólar. Una Unidad de Negocio usa una sola tabla a la vez para sus cuadros comparativos
        ajustados por inflación y en dólares — una misma tabla puede servir a varias unidades.
      </p>

      <CollapsibleAdd>
        <form action={createSeriesEIndicesTabla} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-lg">Tipo de tabla</span>
            <input
              name="tipoTabla"
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
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Tipo de tabla</th>
              <th className="py-1 pr-4">Períodos</th>
              <th className="py-1 pr-4">Unidades vinculadas</th>
              <th className="py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tablas.map((t) => (
              <SeriesTablaRow
                key={t.codTabla}
                codTabla={t.codTabla}
                tipoTabla={t.tipoTabla}
                cantidadFilas={t._count.filas}
                cantidadUnidades={t._count.unidades}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
