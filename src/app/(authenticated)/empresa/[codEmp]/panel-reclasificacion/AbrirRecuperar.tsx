"use client";

import { openInWindow } from "@/lib/openWindow";

export function AbrirRecuperar({
  unidadNegocioId,
  empresaId,
  informeDestinoId,
}: {
  unidadNegocioId: number;
  empresaId: number;
  informeDestinoId: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        openInWindow(
          `/empresa/${unidadNegocioId}/panel-reclasificacion/recuperar?empresaId=${empresaId}&informeDestinoId=${informeDestinoId}`,
          `recuperar-${empresaId}`
        )
      }
      className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50"
    >
      Recuperar Reclasificación
    </button>
  );
}
