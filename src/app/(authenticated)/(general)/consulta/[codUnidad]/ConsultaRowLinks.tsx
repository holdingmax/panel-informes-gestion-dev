"use client";

import { openInWindow } from "@/lib/openWindow";

export function ConsultaRowLinks({ codUnidad, informeId }: { codUnidad: number; informeId: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title="Ver ESP y OyAF (solo lectura)"
        onClick={() =>
          openInWindow(`/empresa/${codUnidad}/informe/${informeId}?soloLectura=1`, "informe")
        }
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        👁 ESP y OyAF
      </button>
      <button
        type="button"
        title="Ver ER y Cuadros (solo lectura)"
        onClick={() =>
          openInWindow(
            `/empresa/${codUnidad}/informe/${informeId}/er-y-cuadros?soloLectura=1`,
            "er-y-cuadros"
          )
        }
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        👁 ER y Cuadros
      </button>
    </div>
  );
}
