"use client";

import { useTransition } from "react";
import { updateCategoriaOyABucketNOF } from "@/lib/categoria-oya-actions";

export function CategoriaOyABucketRow({
  codOyA,
  nomOyA,
  bucketNOF,
}: {
  codOyA: number;
  nomOyA: string;
  bucketNOF: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codOyA}</td>
      <td className="py-2 pr-4">{nomOyA}</td>
      <td className="py-2 pr-4">
        <select
          defaultValue={bucketNOF ?? ""}
          disabled={pending}
          onChange={(e) =>
            startTransition(() => updateCategoriaOyABucketNOF(codOyA, e.target.value))
          }
          className="rounded border px-2 py-1 text-lg"
        >
          <option value="">Sin clasificar</option>
          <option value="OPERATIVO">NOF (Operativo)</option>
          <option value="NO_OPERATIVO">No Operativas</option>
          <option value="FINANCIAMIENTO">Financiamiento Propio</option>
        </select>
      </td>
    </tr>
  );
}
