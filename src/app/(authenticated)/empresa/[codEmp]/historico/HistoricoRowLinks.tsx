"use client";

import { openInWindow } from "@/lib/openWindow";

export function HistoricoRowLinks({ codEmp, informeId }: { codEmp: string; informeId: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => openInWindow(`/empresa/${codEmp}/informe/${informeId}`, "informe")}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        ESP y OyAF
      </button>
      <button
        type="button"
        onClick={() =>
          openInWindow(`/empresa/${codEmp}/informe/${informeId}/er-y-cuadros`, "er-y-cuadros")
        }
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        ER y Cuadros
      </button>
    </div>
  );
}
