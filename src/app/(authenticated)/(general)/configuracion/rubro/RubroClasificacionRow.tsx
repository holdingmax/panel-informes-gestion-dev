"use client";

import { useTransition } from "react";
import { updateRubroCategoriaOyA } from "@/lib/rubro-actions";

export function RubroClasificacionRow({
  codRubro,
  nomRubro,
  categoriaOyA,
}: {
  codRubro: number;
  nomRubro: string;
  categoriaOyA: string | null;
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
          <option value="AJUSTE">Ajuste Ejercicios Anteriores</option>
        </select>
      </td>
    </tr>
  );
}
