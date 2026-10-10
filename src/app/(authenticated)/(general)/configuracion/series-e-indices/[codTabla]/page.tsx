import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  getSeriesEIndicesTabla,
  listSeriesEIndices,
  listUnidadesConSeriesTabla,
} from "@/lib/series-e-indices-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { SeriesEIndicesForm } from "../SeriesEIndicesForm";
import { SeriesEIndicesExcelForm } from "../SeriesEIndicesExcelForm";
import { VincularUnidadesForm } from "../VincularUnidadesForm";
import { SeriesEIndicesRow } from "./SeriesEIndicesRow";

export const dynamic = "force-dynamic";

function formatPeriodo(d: Date) {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

export default async function SeriesEIndicesTablaPage({
  params,
}: {
  params: Promise<{ codTabla: string }>;
}) {
  const { codTabla: codTablaRaw } = await params;
  const codTabla = Number(codTablaRaw);

  const [tabla, series, unidades] = await Promise.all([
    getSeriesEIndicesTabla(codTabla),
    listSeriesEIndices(codTabla),
    listUnidadesConSeriesTabla(),
  ]);
  if (!tabla) notFound();

  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const ultimo = series[series.length - 1];
  const proximo = ultimo
    ? formatPeriodo(new Date(Date.UTC(ultimo.periodo.getUTCFullYear(), ultimo.periodo.getUTCMonth() + 1, 1)))
    : "";

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Series e Índices — {tabla.tipoTabla}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Serie mensual y correlativa (sin huecos) de índice de inflación y dólar para esta
          tabla.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-medium">Unidades de negocio que usan esta tabla</h2>
        {isAdmin ? (
          <VincularUnidadesForm
            codTabla={codTabla}
            unidades={unidades}
            vinculadasIds={unidades.filter((u) => u.seriesTablaId === codTabla).map((u) => u.codUnidad)}
          />
        ) : (
          <p className="text-sm">
            {unidades
              .filter((u) => u.seriesTablaId === codTabla)
              .map((u) => u.nombreUnidad)
              .join(", ") || "—"}
          </p>
        )}
      </section>

      {isAdmin && (
        <div className="flex flex-wrap items-start gap-3">
          <CollapsibleAdd label={ultimo ? `Agregar período (siguiente: ${proximo})` : "Agregar primer período"}>
            <SeriesEIndicesForm tablaId={codTabla} proximoPeriodo={proximo} />
          </CollapsibleAdd>
          <CollapsibleAdd label="Carga de archivo">
            <SeriesEIndicesExcelForm tablaId={codTabla} proximoPeriodo={proximo} />
          </CollapsibleAdd>
        </div>
      )}

      <div className="max-h-96 overflow-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Período</th>
              <th className="py-1 pr-4">Índice</th>
              <th className="py-1 pr-4">Dólar</th>
              <th className="py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <SeriesEIndicesRow
                key={s.id}
                id={s.id}
                periodo={s.periodo}
                indice={s.indice !== null ? Number(s.indice) : null}
                dolar={s.dolar !== null ? Number(s.dolar) : null}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
