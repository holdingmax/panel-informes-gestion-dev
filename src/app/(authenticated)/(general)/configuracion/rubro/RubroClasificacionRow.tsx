"use client";

import { useState, useTransition } from "react";
import {
  updateRubroCategoriaOyA,
  updateRubroNombre,
  checkDeleteRubro,
  deleteRubro,
} from "@/lib/rubro-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function RubroClasificacionRow({
  codRubro,
  nomRubro,
  categoriaOyA,
}: {
  codRubro: number;
  nomRubro: string;
  categoriaOyA: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nombreValue, setNombreValue] = useState(nomRubro);

  function guardarNombre() {
    startTransition(async () => {
      await updateRubroNombre(codRubro, nombreValue);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codRubro}</td>
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
          nomRubro
        )}
      </td>
      <td className="py-2 pr-4">
        <select
          defaultValue={categoriaOyA ?? ""}
          disabled={pending}
          onChange={(e) =>
            startTransition(() => updateRubroCategoriaOyA(codRubro, e.target.value))
          }
          className="rounded border px-2 py-1 text-lg"
        >
          <option value="">Sin clasificar</option>
          <option value="ORIGEN">Origen</option>
          <option value="APLICACION">Aplicación</option>
          <option value="AJUSTE">Ajuste Ejercicios Anteriores</option>
        </select>
      </td>
      <td className="py-2 pr-4">
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
                  setNombreValue(nomRubro);
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
                itemLabel={`"${nomRubro}"`}
                check={() => checkDeleteRubro(codRubro)}
                onConfirm={() => deleteRubro(codRubro)}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
