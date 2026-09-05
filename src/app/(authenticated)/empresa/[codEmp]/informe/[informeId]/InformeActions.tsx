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
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? "..." : label}
        </button>
      )}

      {puedeDescargarPdf && (
        <a
          href={`/api/informes/${informeId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border px-3 py-2 underline"
        >
          Descargar PDF
        </a>
      )}
    </div>
  );
}
