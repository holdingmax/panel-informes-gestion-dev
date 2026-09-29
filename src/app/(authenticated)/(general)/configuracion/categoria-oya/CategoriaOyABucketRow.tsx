"use client";

import { useState, useTransition } from "react";
import {
  updateCategoriaOyABucketNOF,
  updateCategoriaOyANombre,
  checkDeleteCategoriaOyA,
  deleteCategoriaOyA,
} from "@/lib/categoria-oya-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function CategoriaOyABucketRow({
  codOyA,
  nomOyA,
  bucketNOF,
  isAdmin,
}: {
  codOyA: number;
  nomOyA: string;
  bucketNOF: string | null;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nombreValue, setNombreValue] = useState(nomOyA);

  function guardarNombre() {
    startTransition(async () => {
      await updateCategoriaOyANombre(codOyA, nombreValue);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codOyA}</td>
      <td className="py-2 pr-4">
        {editing ? (
          <input
            value={nombreValue}
            onChange={(e) => setNombreValue(e.target.value)}
            maxLength={60}
            disabled={pending}
            className="rounded border px-2 py-1 text-lg"
          />
        ) : (
          nomOyA
        )}
      </td>
      <td className="py-2 pr-4">
        {isAdmin ? (
          <select
            defaultValue={bucketNOF ?? ""}
            disabled={pending}
            onChange={(e) =>
              startTransition(() => updateCategoriaOyABucketNOF(codOyA, e.target.value))
            }
            className="rounded border px-2 py-1 text-lg"
          >
            <option value="">Sin clasificar</option>
            <option value="OPERATIVO">NOF (Operativo)</option>
            <option value="NO_OPERATIVO">No Operativas</option>
            <option value="FINANCIAMIENTO">Financiamiento Propio</option>
          </select>
        ) : (
          bucketNOF ?? "Sin clasificar"
        )}
      </td>
      <td className="py-2 pr-4">
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={guardarNombre}
                  disabled={pending}
                  className="rounded-md bg-accent px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNombreValue(nomOyA);
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
                  itemLabel={`"${nomOyA}"`}
                  check={() => checkDeleteCategoriaOyA(codOyA)}
                  onConfirm={() => deleteCategoriaOyA(codOyA)}
                />
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
