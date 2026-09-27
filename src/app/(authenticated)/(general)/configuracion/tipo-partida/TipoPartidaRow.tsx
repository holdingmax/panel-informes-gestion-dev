"use client";

import { useState, useTransition } from "react";
import {
  updateTipoPartidaNombre,
  updateTipoPartidaRol,
  updateTipoPartidaExigeSaldoCero,
  checkDeleteTipoPartida,
  deleteTipoPartida,
} from "@/lib/tipo-partida-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function TipoPartidaRow({
  codTipo,
  nomTipo,
  rol,
  exigeSaldoCero,
}: {
  codTipo: number;
  nomTipo: string;
  rol: string | null;
  exigeSaldoCero: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nombreValue, setNombreValue] = useState(nomTipo);

  function guardarNombre() {
    startTransition(async () => {
      await updateTipoPartidaNombre(codTipo, nombreValue);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codTipo}</td>
      <td className="py-2 pr-4">
        {editing ? (
          <input
            value={nombreValue}
            onChange={(e) => setNombreValue(e.target.value)}
            maxLength={40}
            disabled={pending}
            className="rounded border px-2 py-1 text-lg"
          />
        ) : (
          nomTipo
        )}
      </td>
      <td className="py-2 pr-4">
        <select
          defaultValue={rol ?? ""}
          disabled={pending}
          onChange={(e) => startTransition(() => updateTipoPartidaRol(codTipo, e.target.value))}
          className="rounded border px-2 py-1 text-lg"
        >
          <option value="">Sin rol (fuera del Balance/Resultado)</option>
          <option value="ACTIVO">Activo (Balance)</option>
          <option value="PASIVO">Pasivo (Balance)</option>
          <option value="PATRIMONIO_NETO">Patrimonio Neto (Balance)</option>
          <option value="RESULTADO">Resultado (Ingresos/Egresos)</option>
        </select>
      </td>
      <td className="py-2 pr-4">
        <input
          type="checkbox"
          defaultChecked={exigeSaldoCero}
          disabled={pending}
          onChange={(e) =>
            startTransition(() => updateTipoPartidaExigeSaldoCero(codTipo, e.target.checked))
          }
          className="h-5 w-5"
        />
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
                  setNombreValue(nomTipo);
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
                itemLabel={`"${nomTipo}"`}
                check={() => checkDeleteTipoPartida(codTipo)}
                onConfirm={() => deleteTipoPartida(codTipo)}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
