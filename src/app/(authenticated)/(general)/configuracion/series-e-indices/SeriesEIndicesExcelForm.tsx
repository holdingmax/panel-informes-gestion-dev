"use client";

import { useActionState } from "react";
import { importarSeriesEIndicesExcel } from "@/lib/series-e-indices-actions";

type ImportState = { creados: number } | { error: string } | null;

export function SeriesEIndicesExcelForm({
  tablaId,
  proximoPeriodo,
}: {
  tablaId: number;
  proximoPeriodo: string;
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    async (_prev, formData) => importarSeriesEIndicesExcel(formData),
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="tablaId" value={tablaId} />
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-zinc-700">
        <p className="font-medium">Formato esperado del Excel</p>
        <ul className="mt-1 list-disc pl-5">
          <li>
            Fila 1 con los encabezados exactos <strong>Período</strong>, <strong>Índice</strong> y{" "}
            <strong>Dólar</strong> (en cualquier orden, en cualquier columna — columnas con otro
            encabezado se ignoran).
          </li>
          <li>Una fila por período debajo del encabezado, sin filas en blanco en el medio.</li>
          <li>
            Período en formato texto <strong>MM-AAAA</strong> (ej. &quot;06-2026&quot;) o una celda
            con una fecha real — es el único campo obligatorio de cada fila.
          </li>
          <li>
            <strong>Índice</strong> y <strong>Dólar</strong> son opcionales: Índice solo hace falta
            si alguna Empresa tiene &quot;Actualiza&quot; en Sí, Dólar solo si alguna tiene Moneda
            secundaria configurada. Si se cargan, tienen que ser números mayores a cero, y cada uno
            tiene que quedar <strong>completo en todos los períodos de la tabla, o vacío en
            todos</strong> — nunca una mezcla.
          </li>
          <li>
            La serie tiene que quedar <strong>correlativa y sin huecos</strong>: si esta tabla ya
            tiene datos, el primer período del archivo tiene que ser{" "}
            {proximoPeriodo ? <strong>{proximoPeriodo}</strong> : "el siguiente al último cargado"}, y
            cada fila siguiente, el mes inmediato posterior.
          </li>
        </ul>
        <p className="mt-2 text-zinc-500">
          Si el archivo no cumple alguna de estas reglas, no se carga nada — el error va a indicar
          la fila y el período exactos para que lo corrijas en el Excel y vuelvas a intentar.
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm">Archivo Excel</span>
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
        <p className="rounded border border-green-400 bg-green-50 p-3 text-sm text-green-800">
          {state.creados} período(s) cargado(s).
        </p>
      )}
    </form>
  );
}
