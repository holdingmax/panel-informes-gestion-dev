"use client";

import { useTransition } from "react";
import { avanzarEstadoInforme } from "@/lib/informe-actions";

const SIGUIENTE_LABEL: Record<string, string> = {
  PROCESO: "Enviar a revisión",
  EN_REVISION: "Aprobar",
  APROBADO: "Marcar como definitivo",
};

export function InformeActions({
  informeId,
  estado,
}: {
  informeId: string;
  estado: string;
}) {
  const [pending, startTransition] = useTransition();
  const label = SIGUIENTE_LABEL[estado];

  const puedeDescargarPdf = estado === "APROBADO" || estado === "DEFINITIVO";

  return (
    <div className="flex items-center gap-4">
      {label && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => avanzarEstadoInforme(informeId))}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "..." : label}
        </button>
      )}

      {puedeDescargarPdf && (
        <a
          href={`/api/informes/${informeId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Descargar PDF
        </a>
      )}
    </div>
  );
}
