import { listSeriesEIndices } from "@/lib/series-e-indices-actions";
import { SeriesEIndicesForm } from "./SeriesEIndicesForm";

export const dynamic = "force-dynamic";

function formatPeriodo(d: Date) {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

export default async function SeriesEIndicesPage() {
  const series = await listSeriesEIndices();
  const ultimo = series[series.length - 1];
  const proximo = ultimo
    ? formatPeriodo(new Date(Date.UTC(ultimo.periodo.getUTCFullYear(), ultimo.periodo.getUTCMonth() + 1, 1)))
    : "";

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Series e Índices</h1>

      <p className="text-sm text-zinc-600">
        Serie única para todas las empresas, correlativa mes a mes (sin huecos). Se usa para
        validar que la información esté al día antes de confeccionar un informe, y para los
        cuadros comparativos ajustados por inflación y en dólares.
      </p>

      <div className="max-h-96 overflow-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Período</th>
              <th className="py-1 pr-4">Índice</th>
              <th className="py-1 pr-4">Dólar</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-1.5 pr-4">{formatPeriodo(s.periodo)}</td>
                <td className="py-1.5 pr-4">{Number(s.indice).toLocaleString("es-AR")}</td>
                <td className="py-1.5 pr-4">{Number(s.dolar).toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex max-w-md flex-col gap-4 rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-medium">
          {ultimo ? `Agregar período (siguiente: ${proximo})` : "Agregar primer período"}
        </h2>
        <SeriesEIndicesForm proximoPeriodo={proximo} />
      </section>
    </main>
  );
}
