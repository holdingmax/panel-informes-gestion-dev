"use client";

import { useState, useTransition } from "react";
import { updateEmpresa, checkDeleteEmpresa, deleteEmpresa } from "@/lib/empresa-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

type MonedaOpcion = { codMoneda: number; nomMoneda: string; simbolo: string };
type MonedaRef = { codMoneda: number; nomMoneda: string; simbolo: string } | null;

function MonedaSelect({
  name,
  monedas,
  defaultValue,
  disabled,
}: {
  name: string;
  monedas: MonedaOpcion[];
  defaultValue: number | null;
  disabled: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      disabled={disabled}
      className="rounded border px-2 py-1 text-sm"
    >
      <option value="">— sin definir —</option>
      {monedas.map((m) => (
        <option key={m.codMoneda} value={m.codMoneda}>
          {m.nomMoneda} ({m.simbolo})
        </option>
      ))}
    </select>
  );
}

export function EmpresaRow({
  codEmp,
  nombreEmp,
  unidadNegocioNombre,
  monedas,
  monedaPrimaria,
  presentaEnMiles,
  monedaSecundaria,
  actualiza,
  monedaActualiza,
  puedeEditar,
}: {
  codEmp: number;
  nombreEmp: string;
  unidadNegocioNombre: string | null;
  monedas: MonedaOpcion[];
  monedaPrimaria: MonedaRef;
  presentaEnMiles: boolean;
  monedaSecundaria: MonedaRef;
  actualiza: boolean;
  monedaActualiza: MonedaRef;
  puedeEditar: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [nombreValue, setNombreValue] = useState(nombreEmp);
  const [pending, startTransition] = useTransition();

  function guardar(formData: FormData) {
    formData.set("nombreEmp", nombreValue);
    startTransition(async () => {
      await updateEmpresa(codEmp, formData);
      setEditing(false);
    });
  }

  if (editing && puedeEditar) {
    return (
      <tr className="border-t align-top">
        <td className="py-2 pr-4">{codEmp}</td>
        <td className="py-2 pr-4" colSpan={5}>
          <form action={guardar} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>Nombre</span>
              <input
                value={nombreValue}
                onChange={(e) => setNombreValue(e.target.value)}
                maxLength={60}
                disabled={pending}
                className="rounded border px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Moneda primaria</span>
              <MonedaSelect
                name="monedaPrimariaId"
                monedas={monedas}
                defaultValue={monedaPrimaria?.codMoneda ?? null}
                disabled={pending}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="presentaEnMiles"
                defaultChecked={presentaEnMiles}
                disabled={pending}
              />
              <span>Presenta en miles</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Moneda secundaria</span>
              <MonedaSelect
                name="monedaSecundariaId"
                monedas={monedas}
                defaultValue={monedaSecundaria?.codMoneda ?? null}
                disabled={pending}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="actualiza" defaultChecked={actualiza} disabled={pending} />
              <span>Actualiza</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Moneda actualiza</span>
              <MonedaSelect
                name="monedaActualizaId"
                monedas={monedas}
                defaultValue={monedaActualiza?.codMoneda ?? null}
                disabled={pending}
              />
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
                  setNombreValue(nombreEmp);
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
      <td className="py-2 pr-4">{codEmp}</td>
      <td className="py-2 pr-4">{nombreEmp}</td>
      <td className="py-2 pr-4">{unidadNegocioNombre ?? "— sin vincular —"}</td>
      <td className="py-2 pr-4">
        {monedaPrimaria ? `${monedaPrimaria.nomMoneda} (${monedaPrimaria.simbolo})` : "—"}
      </td>
      <td className="py-2 pr-4">{presentaEnMiles ? "Sí" : "No"}</td>
      <td className="py-2 pr-4">
        {monedaSecundaria ? `${monedaSecundaria.nomMoneda} (${monedaSecundaria.simbolo})` : "—"}
      </td>
      <td className="py-2 pr-4">
        {actualiza
          ? `Sí${monedaActualiza ? ` (${monedaActualiza.nomMoneda})` : ""}`
          : "No"}
      </td>
      <td className="py-2 pr-4">
        {puedeEditar && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Editar
            </button>
            <ConfirmDeleteButton
              itemLabel={`"${nombreEmp}"`}
              check={() => checkDeleteEmpresa(codEmp)}
              onConfirm={() => deleteEmpresa(codEmp)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}
