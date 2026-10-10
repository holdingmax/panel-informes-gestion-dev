"use client";

import { useState, useTransition } from "react";
import {
  updateSeriesEIndicesValores,
  checkDeleteSeriesEIndices,
  deleteSeriesEIndices,
} from "@/lib/series-e-indices-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

function formatPeriodo(d: Date) {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

export function SeriesEIndicesRow({
  id,
  periodo,
  indice,
  dolar,
  isAdmin,
}: {
  id: string;
  periodo: Date;
  indice: number | null;
  dolar: number | null;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [indiceValue, setIndiceValue] = useState(indice === null ? "" : String(indice));
  const [dolarValue, setDolarValue] = useState(dolar === null ? "" : String(dolar));
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      await updateSeriesEIndicesValores(
        id,
        indiceValue.trim() === "" ? null : Number(indiceValue),
        dolarValue.trim() === "" ? null : Number(dolarValue)
      );
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-1.5 pr-4">{formatPeriodo(periodo)}</td>
      <td className="py-1.5 pr-4">
        {editing ? (
          <input
            value={indiceValue}
            onChange={(e) => setIndiceValue(e.target.value)}
            type="number"
            step="0.000001"
            disabled={pending}
            className="w-32 rounded border px-2 py-1"
          />
        ) : indice !== null ? (
          indice.toLocaleString("es-AR")
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="py-1.5 pr-4">
        {editing ? (
          <input
            value={dolarValue}
            onChange={(e) => setDolarValue(e.target.value)}
            type="number"
            step="0.0001"
            disabled={pending}
            className="w-32 rounded border px-2 py-1"
          />
        ) : dolar !== null ? (
          dolar.toLocaleString("es-AR")
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="py-1.5 pr-4">
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={pending}
                  className="rounded-md bg-accent px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIndiceValue(indice === null ? "" : String(indice));
                    setDolarValue(dolar === null ? "" : String(dolar));
                    setEditing(false);
                  }}
                  disabled={pending}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Editar
                </button>
                <ConfirmDeleteButton
                  itemLabel={`el período ${formatPeriodo(periodo)}`}
                  check={() => checkDeleteSeriesEIndices(id)}
                  onConfirm={() => deleteSeriesEIndices(id)}
                />
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
