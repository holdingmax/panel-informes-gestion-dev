"use client";

import { useState, useTransition } from "react";
import { updateMoneda, checkDeleteMoneda, deleteMoneda } from "@/lib/moneda-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function MonedaRow({
  codMoneda,
  nomMoneda,
  simbolo,
  isAdmin,
}: {
  codMoneda: number;
  nomMoneda: string;
  simbolo: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [nombreValue, setNombreValue] = useState(nomMoneda);
  const [simboloValue, setSimboloValue] = useState(simbolo);
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      await updateMoneda(codMoneda, nombreValue, simboloValue);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-2">{codMoneda}</td>
      <td className="py-2">
        {editing ? (
          <input
            value={nombreValue}
            onChange={(e) => setNombreValue(e.target.value)}
            maxLength={60}
            disabled={pending}
            className="rounded border px-2 py-1 text-lg"
          />
        ) : (
          nomMoneda
        )}
      </td>
      <td className="py-2">
        {editing ? (
          <input
            value={simboloValue}
            onChange={(e) => setSimboloValue(e.target.value)}
            maxLength={5}
            disabled={pending}
            className="rounded border px-2 py-1 text-lg"
          />
        ) : (
          simbolo
        )}
      </td>
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
                    setNombreValue(nomMoneda);
                    setSimboloValue(simbolo);
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
                  itemLabel={`la moneda "${nomMoneda}"`}
                  check={() => checkDeleteMoneda(codMoneda)}
                  onConfirm={() => deleteMoneda(codMoneda)}
                />
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
