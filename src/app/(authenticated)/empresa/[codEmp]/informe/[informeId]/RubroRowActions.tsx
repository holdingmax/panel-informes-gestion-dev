"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { openInWindow } from "@/lib/openWindow";
import { updateRubroBucketNOF } from "@/lib/rubro-actions";

export function RubroRowActions({
  codEmp,
  informeId,
  codRubro,
  bucketNOF,
}: {
  codEmp: string;
  informeId: string;
  codRubro: number;
  bucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO" | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        title="Ver cuentas que componen este rubro"
        onClick={() =>
          openInWindow(
            `/empresa/${codEmp}/informe/${informeId}/rubro/${codRubro}`,
            `rubro-${codRubro}`
          )
        }
        className="text-base leading-none hover:opacity-70"
      >
        👁
      </button>
      <select
        defaultValue={bucketNOF ?? ""}
        disabled={pending}
        title="Necesidades Operativas de Fondos (default del rubro)"
        onChange={(e) =>
          startTransition(async () => {
            await updateRubroBucketNOF(codRubro, e.target.value);
            router.refresh();
          })
        }
        className="rounded border px-1 py-0.5 text-xs"
      >
        <option value="">—</option>
        <option value="OPERATIVO">CTO</option>
        <option value="NO_OPERATIVO">ONP</option>
        <option value="FINANCIAMIENTO">ARS</option>
      </select>
    </span>
  );
}
