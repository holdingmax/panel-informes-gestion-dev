"use client";

import { useState, useTransition } from "react";
import {
  updateSubrubroCampoResultado,
  updateSubrubroNombre,
  checkDeleteSubrubro,
  deleteSubrubro,
} from "@/lib/subrubro-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

const CAMPO_LABEL: Record<string, string> = {
  VENTAS: "Ventas",
  COSTOS_DIRECTOS: "Costos directos/variables",
  GASTOS_OPERATIVOS: "Gastos Fijos Operativos",
  EXPENSAS: "Expensas",
  OTRAS_GANANCIAS_PERDIDAS: "Otras Ganancias y Perdidas",
};

export function SubrubroCampoRow({
  codSubrubro,
  nomSubrubro,
  campoResultado,
  isAdmin,
}: {
  codSubrubro: number;
  nomSubrubro: string;
  campoResultado: string | null;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nombreValue, setNombreValue] = useState(nomSubrubro);

  function guardarNombre() {
    startTransition(async () => {
      await updateSubrubroNombre(codSubrubro, nombreValue);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codSubrubro}</td>
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
          nomSubrubro
        )}
      </td>
      <td className="py-2 pr-4">
        {isAdmin ? (
          <select
            defaultValue={campoResultado ?? ""}
            disabled={pending}
            onChange={(e) =>
              startTransition(() => updateSubrubroCampoResultado(codSubrubro, e.target.value))
            }
            className="rounded border px-2 py-1 text-lg"
          >
            <option value="">Sin clasificar</option>
            {Object.entries(CAMPO_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          (campoResultado ? CAMPO_LABEL[campoResultado] : "Sin clasificar")
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
                    setNombreValue(nomSubrubro);
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
                  itemLabel={`"${nomSubrubro}"`}
                  check={() => checkDeleteSubrubro(codSubrubro)}
                  onConfirm={() => deleteSubrubro(codSubrubro)}
                />
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
