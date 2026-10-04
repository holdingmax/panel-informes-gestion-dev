"use client";

import { useState, useTransition } from "react";
import { setPermisoUnidad, type PermisoInput } from "@/lib/permiso-unidad-actions";

type UnidadOption = { codUnidad: number; nombreUnidad: string };
type PermisoRow = {
  unidadNegocioId: number | null;
  puedeConfiguracion: boolean;
  puedeRevisar: boolean;
  puedeAprobar: boolean;
  puedeAdjuntar: boolean;
};

const SIN_PERMISOS: PermisoInput = {
  acceso: false,
  puedeConfiguracion: false,
  puedeRevisar: false,
  puedeAprobar: false,
  puedeAdjuntar: false,
};

function aEstadoInicial(permisos: PermisoRow[], key: number | null): PermisoInput {
  const fila = permisos.find((p) => p.unidadNegocioId === key);
  if (!fila) return SIN_PERMISOS;
  return {
    acceso: true,
    puedeConfiguracion: fila.puedeConfiguracion,
    puedeRevisar: fila.puedeRevisar,
    puedeAprobar: fila.puedeAprobar,
    puedeAdjuntar: fila.puedeAdjuntar,
  };
}

function FilaPermiso({
  userId,
  unidadNegocioId,
  etiqueta,
  inicial,
}: {
  userId: string;
  unidadNegocioId: number | null;
  etiqueta: string;
  inicial: PermisoInput;
}) {
  const [valor, setValor] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  function campo(key: keyof PermisoInput) {
    return (
      <input
        type="checkbox"
        checked={valor[key]}
        disabled={key !== "acceso" && !valor.acceso}
        onChange={(e) => {
          setGuardado(false);
          setValor((v) => ({ ...v, [key]: e.target.checked }));
        }}
        className="h-4 w-4"
      />
    );
  }

  return (
    <tr className="border-t">
      <td className="py-1.5 pr-2 text-sm">{etiqueta}</td>
      <td className="py-1.5 text-center">{campo("acceso")}</td>
      <td className="py-1.5 text-center">{campo("puedeConfiguracion")}</td>
      <td className="py-1.5 text-center">{campo("puedeRevisar")}</td>
      <td className="py-1.5 text-center">{campo("puedeAprobar")}</td>
      <td className="py-1.5 text-center">{campo("puedeAdjuntar")}</td>
      <td className="py-1.5 pl-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setPermisoUnidad(userId, unidadNegocioId, valor);
              setGuardado(true);
            })
          }
          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardado ? "Guardado" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}

export function PermisosUnidadPanel({
  userId,
  unidades,
  permisos,
}: {
  userId: string;
  unidades: UnidadOption[];
  permisos: PermisoRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {open ? "Cerrar permisos" : "Permisos por unidad"}
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto rounded border bg-zinc-50 p-3">
          <table className="text-left">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="pr-2">Unidad</th>
                <th className="px-1 text-center">Acceso</th>
                <th className="px-1 text-center">Configuración</th>
                <th className="px-1 text-center">Revisar</th>
                <th className="px-1 text-center">Aprobar</th>
                <th className="px-1 text-center">Adjuntar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <FilaPermiso
                userId={userId}
                unidadNegocioId={null}
                etiqueta="Todas las unidades"
                inicial={aEstadoInicial(permisos, null)}
              />
              {unidades.map((u) => (
                <FilaPermiso
                  key={u.codUnidad}
                  userId={userId}
                  unidadNegocioId={u.codUnidad}
                  etiqueta={u.nombreUnidad}
                  inicial={aEstadoInicial(permisos, u.codUnidad)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
