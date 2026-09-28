"use client";

import { useActionState } from "react";
import { importarResultadosHistoricosExcel } from "@/lib/resultados-historicos-actions";

type ImportState =
  | {
      creados: number;
      omitidosPorConflicto: { periodoMes: number; periodoAnio: number }[];
      omitidosPorDatosIncompletos: number;
    }
  | { error: string }
  | null;

export function ImportarExcelForm({ unidadNegocioId }: { unidadNegocioId: number }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    async (_prev, formData) => importarResultadosHistoricosExcel(formData),
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="unidadNegocioId" value={unidadNegocioId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm">
          Archivo Excel (fila 1 con los encabezados de columna — Período, Ventas, Costos
          Directos, Gastos Operativos, Expensas, Otras Ganancias y Pérdidas, en cualquier orden —
          y una fila por período debajo)
        </span>
        <input name="archivo" type="file" accept=".xlsx,.xls" required className="rounded border px-3 py-2" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Procesando..." : "Cargar Excel"}
      </button>

      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}

      {state && "creados" in state && (
        <div className="flex flex-col gap-1 rounded border border-green-400 bg-green-50 p-3 text-sm text-green-800">
          <p>{state.creados} período(s) cargado(s).</p>
          {state.omitidosPorDatosIncompletos > 0 && (
            <p>{state.omitidosPorDatosIncompletos} período(s) omitido(s) por datos incompletos.</p>
          )}
          {state.omitidosPorConflicto.length > 0 && (
            <div>
              <p className="font-medium text-amber-800">
                {state.omitidosPorConflicto.length} período(s) ya existían y NO se sobreescribieron:
              </p>
              <ul className="list-disc pl-5">
                {state.omitidosPorConflicto.map((p) => (
                  <li key={`${p.periodoAnio}-${p.periodoMes}`}>
                    {String(p.periodoMes).padStart(2, "0")}-{p.periodoAnio}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
