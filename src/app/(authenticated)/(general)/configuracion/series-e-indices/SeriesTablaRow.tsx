"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateSeriesEIndicesTabla,
  checkDeleteSeriesEIndicesTabla,
  deleteSeriesEIndicesTabla,
} from "@/lib/series-e-indices-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function SeriesTablaRow({
  codTabla,
  tipoTabla,
  cantidadFilas,
  cantidadUnidades,
  isAdmin,
}: {
  codTabla: number;
  tipoTabla: string;
  cantidadFilas: number;
  cantidadUnidades: number;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tipoTabla);
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      await updateSeriesEIndicesTabla(codTabla, value);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codTabla}</td>
      <td className="py-2 pr-4">
        {editing && isAdmin ? (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={60}
            disabled={pending}
            className="rounded border px-2 py-1 text-lg"
          />
        ) : (
          <Link href={`/configuracion/series-e-indices/${codTabla}`} className="underline hover:text-accent">
            {tipoTabla}
          </Link>
        )}
      </td>
      <td className="py-2 pr-4">{cantidadFilas}</td>
      <td className="py-2 pr-4">{cantidadUnidades}</td>
      <td className="py-2">
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
                    setValue(tipoTabla);
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
                  itemLabel={`la tabla "${tipoTabla}"`}
                  check={() => checkDeleteSeriesEIndicesTabla(codTabla)}
                  onConfirm={() => deleteSeriesEIndicesTabla(codTabla)}
                />
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
