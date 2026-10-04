"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlanDeCuentaSubrubro } from "@/lib/plan-de-cuentas-actions";

function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

export function DetalleSinSubrubroRow({
  planDeCuentaId,
  empresaNombre,
  cuenta,
  saldoInicio,
  saldoFinal,
  subrubros,
  puedeEditar,
}: {
  planDeCuentaId: string | null;
  empresaNombre: string;
  cuenta: string;
  saldoInicio: number;
  saldoFinal: number;
  subrubros: { codSubrubro: number; nomSubrubro: string }[];
  puedeEditar: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <tr className="border-t border-zinc-200">
      <td className="py-1 pl-3">{empresaNombre}</td>
      <td className="py-1">{cuenta}</td>
      <td className="py-1 pr-3 text-right">{fmtParen(saldoFinal)}</td>
      <td className="py-1 pr-3 text-right">{fmtParen(saldoInicio)}</td>
      {puedeEditar && (
        <td className="py-1 pr-3">
          {editing ? (
            <select
              defaultValue=""
              disabled={pending}
              className="rounded border px-1 py-0.5 text-sm"
              onChange={(e) => {
                const nuevoId = Number(e.target.value);
                if (!Number.isInteger(nuevoId)) return;
                startTransition(async () => {
                  await updatePlanDeCuentaSubrubro(planDeCuentaId!, nuevoId);
                  setEditing(false);
                  router.refresh();
                });
              }}
            >
              <option value="">Seleccionar...</option>
              {subrubros.map((s) => (
                <option key={s.codSubrubro} value={s.codSubrubro}>
                  {s.nomSubrubro}
                </option>
              ))}
            </select>
          ) : (
            planDeCuentaId && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={pending}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Clasificar
              </button>
            )
          )}
        </td>
      )}
    </tr>
  );
}
