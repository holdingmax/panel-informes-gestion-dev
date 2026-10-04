"use client";

import { useRef, useState, useTransition } from "react";
import {
  updateUnidadNegocioNombre,
  updateUnidadNegocioLogo,
  checkDeleteUnidadNegocio,
  deleteUnidadNegocio,
} from "@/lib/unidad-negocio-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { EmpresasVinculadasForm } from "./EmpresasVinculadasForm";

type EmpresaOpcion = { codEmp: number; nombreEmp: string };

export function UnidadNegocioRow({
  codUnidad,
  nombreUnidad,
  imagenMime,
  empresas,
  vinculadasIds,
  puedeConfiguracion,
}: {
  codUnidad: number;
  nombreUnidad: string;
  imagenMime: string | null;
  empresas: EmpresaOpcion[];
  vinculadasIds: number[];
  puedeConfiguracion: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [nombreValue, setNombreValue] = useState(nombreUnidad);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function guardar() {
    startTransition(async () => {
      await updateUnidadNegocioNombre(codUnidad, nombreValue);
      const file = fileInputRef.current?.files?.[0];
      if (file) {
        const formData = new FormData();
        formData.set("codUnidad", String(codUnidad));
        formData.set("imagen", file);
        await updateUnidadNegocioLogo(formData);
      }
      setEditing(false);
    });
  }

  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-4">{codUnidad}</td>
      <td className="py-2 pr-4">
        {imagenMime ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/unidades-negocio/${codUnidad}/logo`}
            alt={nombreUnidad}
            className="h-10 w-10 object-contain"
          />
        ) : (
          "—"
        )}
        {editing && puedeConfiguracion && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            disabled={pending}
            className="mt-1 w-40 text-xs"
          />
        )}
      </td>
      <td className="py-2 pr-4">
        {editing && puedeConfiguracion ? (
          <input
            value={nombreValue}
            onChange={(e) => setNombreValue(e.target.value)}
            maxLength={35}
            disabled={pending}
            className="rounded border px-2 py-1 text-lg"
          />
        ) : (
          nombreUnidad
        )}
      </td>
      <td className="py-2 text-sm">
        {puedeConfiguracion ? (
          <EmpresasVinculadasForm codUnidad={codUnidad} empresas={empresas} vinculadasIds={vinculadasIds} />
        ) : (
          empresas
            .filter((e) => vinculadasIds.includes(e.codEmp))
            .map((e) => e.nombreEmp)
            .join(", ") || "—"
        )}
      </td>
      <td className="py-2 pr-4">
        {puedeConfiguracion && (
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
                    setNombreValue(nombreUnidad);
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
                  itemLabel={`"${nombreUnidad}"`}
                  check={() => checkDeleteUnidadNegocio(codUnidad)}
                  onConfirm={() => deleteUnidadNegocio(codUnidad)}
                />
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
