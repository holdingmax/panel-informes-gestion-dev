"use client";

import { useState, useTransition } from "react";
import {
  updateResultadoHistorico,
  checkDeleteResultadoHistorico,
  deleteResultadoHistorico,
} from "@/lib/resultados-historicos-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

function fmt(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

type Valores = {
  ventas: number;
  costosDirectos: number;
  gastosOperativos: number;
  expensas: number;
  otrasGananciasYPerdidas: number;
};

const CAMPOS: { key: keyof Valores; label: string }[] = [
  { key: "ventas", label: "Ventas" },
  { key: "costosDirectos", label: "Costos Directos" },
  { key: "gastosOperativos", label: "Gastos Operativos" },
  { key: "expensas", label: "Expensas" },
  { key: "otrasGananciasYPerdidas", label: "Otras Ganancias y Pérdidas" },
];

export function ResultadoHistoricoRow({
  id,
  periodoMes,
  periodoAnio,
  ...valoresIniciales
}: { id: string; periodoMes: number; periodoAnio: number } & Valores) {
  const [editing, setEditing] = useState(false);
  const [valores, setValores] = useState<Valores>(valoresIniciales);
  const [pending, startTransition] = useTransition();

  const resultadoNeto =
    valores.ventas +
    valores.costosDirectos +
    valores.gastosOperativos +
    valores.expensas +
    valores.otrasGananciasYPerdidas;

  function guardar() {
    const formData = new FormData();
    for (const { key } of CAMPOS) formData.set(key, String(valores[key]));
    startTransition(async () => {
      await updateResultadoHistorico(id, formData);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t border-zinc-100">
      <td className="py-1.5 pl-4 pr-4">
        {String(periodoMes).padStart(2, "0")}-{periodoAnio}
      </td>
      {CAMPOS.map(({ key }) => (
        <td key={key} className="py-1.5 pr-4 text-right">
          {editing ? (
            <input
              type="number"
              step="0.01"
              value={valores[key]}
              onChange={(e) => setValores((v) => ({ ...v, [key]: Number(e.target.value) }))}
              disabled={pending}
              className="w-32 rounded border px-2 py-1 text-right"
            />
          ) : (
            fmt(valores[key])
          )}
        </td>
      ))}
      <td className="py-1.5 pr-4 text-right font-medium">{fmt(resultadoNeto)}</td>
      <td className="py-1.5 pr-4">
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
                  setValores(valoresIniciales);
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
                itemLabel={`el período "${String(periodoMes).padStart(2, "0")}-${periodoAnio}"`}
                check={() => checkDeleteResultadoHistorico()}
                onConfirm={() => deleteResultadoHistorico(id)}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
