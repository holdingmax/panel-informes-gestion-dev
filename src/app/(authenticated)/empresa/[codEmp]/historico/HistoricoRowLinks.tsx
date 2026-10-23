"use client";

import { openInWindow } from "@/lib/openWindow";

export function HistoricoRowLinks({
  codEmp,
  informeId,
  aprobado,
}: {
  codEmp: string;
  informeId: string;
  aprobado: boolean;
}) {
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
        ER
      </button>
      <button
        type="button"
        onClick={() => openInWindow(`/empresa/${codEmp}/informe/${informeId}/cuadros`, "cuadros")}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Cuadros
      </button>
      {/* Mismo PDF que en Consulta. Si el informe no está aprobado se descarga
          completo, pero marcado como NO APROBADO en todas las hojas. */}
      <a
        href={`/api/informes/${informeId}/pdf?descargar=1`}
        title={
          aprobado
            ? "Descargar el informe en PDF"
            : "Descargar el informe en PDF con los datos de hoy, marcado como NO APROBADO"
        }
        className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        ⬇ Descargar informe{aprobado ? "" : " (no aprobado)"}
      </a>
    </div>
  );
}
