"use client";

import { openInWindow } from "@/lib/openWindow";
import { checkDeleteInforme, deleteInforme } from "@/lib/informe-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function InformeAcciones({
  codEmp,
  informeId,
  estado,
  periodoLabel,
}: {
  codEmp: string;
  informeId: string;
  estado: string;
  periodoLabel: string;
}) {
  if (estado !== "PROCESO") return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => openInWindow(`/empresa/${codEmp}/confeccionar-informe`, "confeccionar-informe")}
        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Editar
      </button>
      <ConfirmDeleteButton
        itemLabel={`el informe "${periodoLabel}"`}
        check={() => checkDeleteInforme(informeId)}
        onConfirm={() => deleteInforme(informeId)}
      />
    </div>
  );
}
