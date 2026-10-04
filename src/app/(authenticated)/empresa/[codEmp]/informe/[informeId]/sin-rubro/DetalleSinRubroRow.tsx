"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlanDeCuentaRubro } from "@/lib/plan-de-cuentas-actions";

function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

export function DetalleSinRubroRow({
  planDeCuentaId,
  empresaNombre,
  cuenta,
  saldoInicio,
  saldoFinal,
  rubros,
  puedeEditar,
}: {
  planDeCuentaId: string | null;
  empresaNombre: string;
  cuenta: string;
  saldoInicio: number;
  saldoFinal: number;
  rubros: { codRubro: number; nomRubro: string }[];
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
                  await updatePlanDeCuentaRubro(planDeCuentaId!, nuevoId);
                  setEditing(false);
                  router.refresh();
                });
              }}
            >
              <option value="">Seleccionar...</option>
              {rubros.map((r) => (
                <option key={r.codRubro} value={r.codRubro}>
                  {r.nomRubro}
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
