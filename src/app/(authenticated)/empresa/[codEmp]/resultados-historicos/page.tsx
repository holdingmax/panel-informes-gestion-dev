import { auth } from "@/auth";
import { listResultadosHistoricos, createResultadoHistorico } from "@/lib/resultados-historicos-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { ResultadoHistoricoRow } from "./ResultadoHistoricoRow";
import { ImportarExcelForm } from "./ImportarExcelForm";

export const dynamic = "force-dynamic";

export default async function ResultadosHistoricosPage({
  params,
}: {
  params: Promise<{ codEmp: string }>;
}) {
  const { codEmp } = await params;
  const unidadNegocioId = Number(codEmp);

  const filas = await listResultadosHistoricos(unidadNegocioId);
  const now = new Date();
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Resultados Históricos</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Valores nominales por mes que alimentan los cuadros de ER y Cuadros (Ventas, Costos
          Directos, Gastos Operativos, Expensas y Otras Ganancias y Pérdidas). Se cargan a mano
          para períodos anteriores al sistema, y automáticamente al aprobar cada informe.
          &quot;Resultado Neto&quot; es la suma de los 5 campos, solo a modo de control visual.
        </p>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-4">
          <CollapsibleAdd label="Agregar período">
            <form action={createResultadoHistorico} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="unidadNegocioId" value={unidadNegocioId} />
              <label className="flex flex-col gap-1">
                <span className="text-sm">Período (MM-AAAA)</span>
                <input
                  name="periodo"
                  required
                  pattern="\d{2}-\d{4}"
                  placeholder={`${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`}
                  className="rounded border px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Ventas</span>
                <input name="ventas" type="number" step="0.01" required className="w-32 rounded border px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Costos Directos</span>
                <input name="costosDirectos" type="number" step="0.01" required className="w-32 rounded border px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Gastos Operativos</span>
                <input name="gastosOperativos" type="number" step="0.01" required className="w-32 rounded border px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Expensas</span>
                <input name="expensas" type="number" step="0.01" required className="w-32 rounded border px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Otras Ganancias y Pérdidas</span>
                <input
                  name="otrasGananciasYPerdidas"
                  type="number"
                  step="0.01"
                  required
                  className="w-32 rounded border px-3 py-2"
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

          <CollapsibleAdd label="Cargar por Excel">
            <ImportarExcelForm unidadNegocioId={unidadNegocioId} />
          </CollapsibleAdd>
        </div>
      )}

      {filas.length === 0 ? (
        <p className="text-sm text-zinc-600">Todavía no hay períodos cargados.</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-lg bg-white shadow">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="py-2 pl-4 pr-4">Período</th>
                <th className="py-2 pr-4 text-right">Ventas</th>
                <th className="py-2 pr-4 text-right">Costos Directos</th>
                <th className="py-2 pr-4 text-right">Gastos Operativos</th>
                <th className="py-2 pr-4 text-right">Expensas</th>
                <th className="py-2 pr-4 text-right">Otras Ganancias y Pérdidas</th>
                <th className="py-2 pr-4 text-right">Resultado Neto</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <ResultadoHistoricoRow
                  key={f.id}
                  id={f.id}
                  periodoMes={f.periodoMes}
                  periodoAnio={f.periodoAnio}
                  ventas={Number(f.ventas)}
                  costosDirectos={Number(f.costosDirectos)}
                  gastosOperativos={Number(f.gastosOperativos)}
                  expensas={Number(f.expensas)}
                  otrasGananciasYPerdidas={Number(f.otrasGananciasYPerdidas)}
                  isAdmin={isAdmin}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
