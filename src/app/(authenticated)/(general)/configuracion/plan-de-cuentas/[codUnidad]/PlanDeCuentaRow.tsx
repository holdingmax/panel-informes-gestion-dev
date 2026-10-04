"use client";

import { useState, useTransition } from "react";
import {
  updatePlanDeCuentas,
  checkDeletePlanDeCuentas,
  deletePlanDeCuentas,
} from "@/lib/plan-de-cuentas-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

type Opcion = { id: number; nombre: string };

export function PlanDeCuentaRow({
  id,
  nombreEmpresa,
  cuenta,
  rubroId,
  subrubroId,
  subrubro2Id,
  subrubro3Id,
  categoriaOyAId,
  nombrePartida,
  nombreRubro,
  nombreSubrubro,
  nombreSubrubro2,
  nombreSubrubro3,
  nombreCategoriaOyA,
  rubros,
  subrubros,
  subrubros2,
  subrubros3,
  categorias,
  puedeConfiguracion,
}: {
  id: string;
  nombreEmpresa: string;
  cuenta: string;
  rubroId: number | null;
  subrubroId: number | null;
  subrubro2Id: number | null;
  subrubro3Id: number | null;
  categoriaOyAId: number | null;
  nombrePartida: string | null;
  nombreRubro: string | null;
  nombreSubrubro: string | null;
  nombreSubrubro2: string | null;
  nombreSubrubro3: string | null;
  nombreCategoriaOyA: string | null;
  rubros: Opcion[];
  subrubros: Opcion[];
  subrubros2: Opcion[];
  subrubros3: Opcion[];
  categorias: Opcion[];
  puedeConfiguracion: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [cuentaValue, setCuentaValue] = useState(cuenta);
  const [pending, startTransition] = useTransition();

  function guardar(formData: FormData) {
    formData.set("cuenta", cuentaValue);
    startTransition(async () => {
      await updatePlanDeCuentas(id, formData);
      setEditing(false);
    });
  }

  if (editing && puedeConfiguracion) {
    return (
      <tr className="border-t align-top">
        <td className="py-1.5 pr-4">{nombreEmpresa}</td>
        <td className="py-1.5 pr-4" colSpan={8}>
          <form action={guardar} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span>Cuenta</span>
              <input
                value={cuentaValue}
                onChange={(e) => setCuentaValue(e.target.value)}
                maxLength={90}
                disabled={pending}
                className="w-56 rounded border px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>Rubro (ESP)</span>
              <select
                name="rubroId"
                defaultValue={rubroId ?? ""}
                disabled={pending}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Sin clasificar</option>
                {rubros.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>Subrubro (ER)</span>
              <select
                name="subrubroId"
                defaultValue={subrubroId ?? ""}
                disabled={pending}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Sin clasificar</option>
                {subrubros.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>Subrubro 2</span>
              <select
                name="subrubro2Id"
                defaultValue={subrubro2Id ?? ""}
                disabled={pending}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Sin clasificar</option>
                {subrubros2.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>Subrubro 3</span>
              <select
                name="subrubro3Id"
                defaultValue={subrubro3Id ?? ""}
                disabled={pending}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Sin clasificar</option>
                {subrubros3.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>Categoría OyA</span>
              <select
                name="categoriaOyAId"
                defaultValue={categoriaOyAId ?? ""}
                disabled={pending}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Sin clasificar</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-accent px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setCuentaValue(cuenta);
                  setEditing(false);
                }}
                disabled={pending}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t">
      <td className="py-1.5 pr-4">{nombreEmpresa}</td>
      <td className="py-1.5 pr-4">{cuenta}</td>
      <td className="py-1.5 pr-4">{nombrePartida ?? "—"}</td>
      <td className="py-1.5 pr-4">{nombreRubro ?? "—"}</td>
      <td className="py-1.5 pr-4">{nombreSubrubro ?? "—"}</td>
      <td className="py-1.5 pr-4">{nombreSubrubro2 ?? "—"}</td>
      <td className="py-1.5 pr-4">{nombreSubrubro3 ?? "—"}</td>
      <td className="py-1.5 pr-4">{nombreCategoriaOyA ?? "—"}</td>
      <td className="py-1.5 pr-4">
        {puedeConfiguracion && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Editar
            </button>
            <ConfirmDeleteButton
              itemLabel={`la cuenta "${cuenta}"`}
              check={() => checkDeletePlanDeCuentas()}
              onConfirm={() => deletePlanDeCuentas(id)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}
