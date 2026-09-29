"use client";

import { useState, useTransition } from "react";
import {
  updatePartidaTipoId,
  updatePartidaNombre,
  checkDeletePartida,
  deletePartida,
} from "@/lib/partida-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

type TipoOpcion = { codTipo: number; nomTipo: string };

export function PartidaTipoRow({
  codPartida,
  nomPartida,
  tipoId,
  tipos,
  isAdmin,
}: {
  codPartida: number;
  nomPartida: string;
  tipoId: number | null;
  tipos: TipoOpcion[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nombreValue, setNombreValue] = useState(nomPartida);

  function guardarNombre() {
    startTransition(async () => {
      await updatePartidaNombre(codPartida, nombreValue);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codPartida}</td>
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
          nomPartida
        )}
      </td>
      <td className="py-2 pr-4">
        {isAdmin ? (
          <select
            defaultValue={tipoId ?? ""}
            disabled={pending}
            onChange={(e) => startTransition(() => updatePartidaTipoId(codPartida, e.target.value))}
            className="rounded border px-2 py-1 text-lg"
          >
            <option value="">Sin clasificar</option>
            {tipos.map((t) => (
              <option key={t.codTipo} value={t.codTipo}>
                {t.nomTipo}
              </option>
            ))}
          </select>
        ) : (
          tipos.find((t) => t.codTipo === tipoId)?.nomTipo ?? "Sin clasificar"
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
                    setNombreValue(nomPartida);
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
                  itemLabel={`"${nomPartida}"`}
                  check={() => checkDeletePartida(codPartida)}
                  onConfirm={() => deletePartida(codPartida)}
                />
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
