"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { openInWindow } from "@/lib/openWindow";
import { updateRubroBucketNOFDeUnidad } from "@/lib/rubro-actions";

const BUCKET_LABEL: Record<string, string> = {
  OPERATIVO: "CTO",
  NO_OPERATIVO: "ONP",
  FINANCIAMIENTO: "ARS",
};

export function RubroRowActions({
  codEmp,
  informeId,
  codRubro,
  bucketNOF,
  puedeEditarNOF,
  soloLectura = false,
}: {
  codEmp: string;
  informeId: string;
  codRubro: number;
  bucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO" | null;
  // Permiso de confeccionar informes en esta unidad, con el informe todavía abierto.
  puedeEditarNOF: boolean;
  soloLectura?: boolean;
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
            `/empresa/${codEmp}/informe/${informeId}/rubro/${codRubro}${soloLectura ? "?soloLectura=1" : ""}`,
            `rubro-${codRubro}`
          )
        }
        className="text-2xl leading-none hover:opacity-70"
      >
        👁
      </button>
      {puedeEditarNOF && !soloLectura ? (
        <select
          defaultValue={bucketNOF ?? ""}
          disabled={pending}
          title="Necesidades Operativas de Fondos: solo cambia en esta unidad de negocio"
          onChange={(e) =>
            startTransition(async () => {
              // codEmp es el código de la unidad de negocio (la ruta /empresa/[codEmp]).
              await updateRubroBucketNOFDeUnidad(Number(codEmp), codRubro, e.target.value);
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
      ) : (
        <span className="text-xs">{bucketNOF ? BUCKET_LABEL[bucketNOF] : "—"}</span>
      )}
    </span>
  );
}
