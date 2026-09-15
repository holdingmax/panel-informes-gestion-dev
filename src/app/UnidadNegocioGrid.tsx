"use client";

import { openInWindow } from "@/lib/openWindow";

type UnidadNegocioTile = {
  codUnidad: number;
  nombreUnidad: string;
  imagenMime: string | null;
};

export function UnidadNegocioGrid({ unidades }: { unidades: UnidadNegocioTile[] }) {
  if (unidades.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Todavía no hay unidades de negocio configuradas. Agregalas desde Opciones → Configuración.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {unidades.map((unidad) => (
        <button
          key={unidad.codUnidad}
          onClick={() =>
            openInWindow(`/empresa/${unidad.codUnidad}`, `unidad-${unidad.codUnidad}`)
          }
          className="flex flex-col items-center gap-3 rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {unidad.imagenMime ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/unidades-negocio/${unidad.codUnidad}/logo`}
              alt={unidad.nombreUnidad}
              className="h-32 w-32 object-contain"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400">
              Sin logo
            </div>
          )}
          <span className="text-base font-medium">{unidad.nombreUnidad}</span>
        </button>
      ))}
    </div>
  );
}
