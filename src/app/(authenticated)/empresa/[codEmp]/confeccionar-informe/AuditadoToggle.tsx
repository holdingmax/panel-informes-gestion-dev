"use client";

import { useState, useTransition } from "react";
import { updateInformeAuditado } from "@/lib/informe-actions";

export function AuditadoToggle({
  informeId,
  auditado,
}: {
  informeId: string;
  auditado: boolean;
}) {
  const [valor, setValor] = useState(auditado);
  const [pending, startTransition] = useTransition();

  function elegir(nuevo: boolean) {
    setValor(nuevo);
    startTransition(() => updateInformeAuditado(informeId, nuevo));
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-zinc-700">Auditado</span>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          checked={!valor}
          disabled={pending}
          onChange={() => elegir(false)}
        />
        <span>No</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" checked={valor} disabled={pending} onChange={() => elegir(true)} />
        <span>Sí</span>
      </label>
      {!valor && (
        <span className="text-xs text-amber-700">
          El PDF va a mostrar el recuadro &quot;INFORME PROVISORIO&quot; mientras esto esté en
          &quot;No&quot;.
        </span>
      )}
    </div>
  );
}
