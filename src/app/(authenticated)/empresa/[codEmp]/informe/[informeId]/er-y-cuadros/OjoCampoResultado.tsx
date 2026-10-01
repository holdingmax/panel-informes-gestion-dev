"use client";

import { openInWindow } from "@/lib/openWindow";
import type { ResultadoNominal } from "@/lib/resultado-nominal";

export function OjoCampoResultado({
  codEmp,
  informeId,
  campo,
}: {
  codEmp: string;
  informeId: string;
  campo: keyof ResultadoNominal;
}) {
  return (
    <button
      type="button"
      title="Ver cuentas que componen este campo"
      onClick={() =>
        openInWindow(
          `/empresa/${codEmp}/informe/${informeId}/er-y-cuadros/campo/${campo}`,
          `campo-${campo}`
        )
      }
      className="text-2xl leading-none hover:opacity-70"
    >
      👁
    </button>
  );
}
