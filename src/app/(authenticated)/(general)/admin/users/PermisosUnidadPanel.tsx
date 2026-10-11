"use client";

import { useState, useTransition } from "react";
import { setPermisoUnidad, type PermisoInput } from "@/lib/permiso-unidad-actions";

type UnidadOption = { codUnidad: number; nombreUnidad: string };
type PermisoRow = PermisoInput & { unidadNegocioId: number | null };

const SIN_PERMISOS: PermisoInput = {
  puedeConsultar: false,
  puedeRevisar: false,
  puedeAprobar: false,
  puedeAdjuntar: false,
  puedeConfeccionar: false,
  puedeConfiguracion: false,
  puedeReclasificar: false,
  puedeEliminar: false,
};

// Cada hijo depende del acceso de su ventana (Consulta / Confección).
const PADRE: Partial<Record<keyof PermisoInput, keyof PermisoInput>> = {
  puedeRevisar: "puedeConsultar",
  puedeAprobar: "puedeConsultar",
  puedeAdjuntar: "puedeConsultar",
  puedeConfiguracion: "puedeConfeccionar",
  puedeReclasificar: "puedeConfeccionar",
  puedeEliminar: "puedeConfeccionar",
};

function aEstadoInicial(permisos: PermisoRow[], key: number | null): PermisoInput {
  const fila = permisos.find((p) => p.unidadNegocioId === key);
  if (!fila) return SIN_PERMISOS;
  return {
    puedeConsultar: fila.puedeConsultar,
    puedeRevisar: fila.puedeRevisar,
    puedeAprobar: fila.puedeAprobar,
    puedeAdjuntar: fila.puedeAdjuntar,
    puedeConfeccionar: fila.puedeConfeccionar,
    puedeConfiguracion: fila.puedeConfiguracion,
    puedeReclasificar: fila.puedeReclasificar,
    puedeEliminar: fila.puedeEliminar,
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
  const [error, setError] = useState<string | null>(null);

  function campo(key: keyof PermisoInput, celda?: string) {
    const padre = PADRE[key];
    return (
      <td className={`py-1.5 text-center ${celda ?? ""}`}>
        <input
          type="checkbox"
          aria-label={`${etiqueta}: ${key}`}
          checked={valor[key]}
          disabled={padre ? !valor[padre] : false}
          onChange={(e) => {
            setGuardado(false);
            setValor((v) => {
              const siguiente = { ...v, [key]: e.target.checked };
              // Al apagar el acceso de una ventana se apagan sus hijos.
              if (!e.target.checked) {
                for (const [hijo, p] of Object.entries(PADRE)) {
                  if (p === key) siguiente[hijo as keyof PermisoInput] = false;
                }
              }
              return siguiente;
            });
          }}
          className="h-4 w-4"
        />
      </td>
    );
  }

  return (
    <tr className="border-t">
      <td className="py-1.5 pr-3 text-sm">{etiqueta}</td>
      {campo("puedeConsultar", "border-l border-slate-300")}
      {campo("puedeRevisar")}
      {campo("puedeAprobar")}
      {campo("puedeAdjuntar")}
      {campo("puedeConfeccionar", "border-l border-slate-300")}
      {campo("puedeConfiguracion")}
      {campo("puedeReclasificar")}
      {campo("puedeEliminar")}
      <td className="py-1.5 pl-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                setError(null);
                await setPermisoUnidad(userId, unidadNegocioId, valor);
                setGuardado(true);
              } catch {
                setError("No se pudo guardar.");
              }
            })
          }
          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardado ? "Guardado" : "Guardar"}
        </button>
        {error && <span className="ml-2 text-xs text-red-700">{error}</span>}
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
              <tr className="text-xs font-semibold text-zinc-700">
                <th />
                <th colSpan={4} className="border-l border-slate-300 px-1 text-center">
                  Consulta
                </th>
                <th colSpan={4} className="border-l border-slate-300 px-1 text-center">
                  Confección de informes
                </th>
                <th />
              </tr>
              <tr className="text-xs text-zinc-500">
                <th className="pr-3">Unidad</th>
                <th className="border-l border-slate-300 px-1 text-center">Acceso</th>
                <th className="px-1 text-center">Revisar</th>
                <th className="px-1 text-center">Aprobar</th>
                <th className="px-1 text-center">Adjuntar</th>
                <th className="border-l border-slate-300 px-1 text-center">Acceso</th>
                <th className="px-1 text-center">Configuración</th>
                <th className="px-1 text-center">Reclasificar</th>
                <th className="px-1 text-center">Eliminar</th>
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
          <p className="mt-2 text-xs text-zinc-500">
            El acceso a una unidad incluye todas sus empresas. «Todas las unidades» también cubre las que se creen después.
          </p>
        </div>
      )}
    </div>
  );
}
