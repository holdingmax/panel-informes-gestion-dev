"use client";

import { useTransition } from "react";
import { updateRubroCategoriaOyA, updateRubroBucketNOF } from "@/lib/rubro-actions";

export function RubroClasificacionRow({
  codRubro,
  nomRubro,
  categoriaOyA,
  bucketNOF,
}: {
  codRubro: number;
  nomRubro: string;
  categoriaOyA: string | null;
  bucketNOF: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codRubro}</td>
      <td className="py-2 pr-4">{nomRubro}</td>
      <td className="py-2 pr-4">
        <select
          defaultValue={categoriaOyA ?? ""}
          disabled={pending}
          onChange={(e) =>
            startTransition(() => updateRubroCategoriaOyA(codRubro, e.target.value))
          }
          className="rounded border px-2 py-1 text-lg"
        >
          <option value="">Sin clasificar</option>
          <option value="ORIGEN">Origen</option>
          <option value="APLICACION">Aplicación</option>
        </select>
      </td>
      <td className="py-2 pr-4">
        <select
          defaultValue={bucketNOF ?? ""}
          disabled={pending}
          onChange={(e) => startTransition(() => updateRubroBucketNOF(codRubro, e.target.value))}
          className="rounded border px-2 py-1 text-lg"
        >
          <option value="">Sin clasificar</option>
          <option value="OPERATIVO">Operativo</option>
          <option value="NO_OPERATIVO">No operativo</option>
          <option value="FINANCIAMIENTO">Financiamiento propio</option>
        </select>
      </td>
    </tr>
  );
}
