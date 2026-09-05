"use client";

import { useTransition } from "react";
import { updatePartidaTipo } from "@/lib/partida-actions";

export function PartidaTipoRow({
  codPartida,
  nomPartida,
  tipo,
}: {
  codPartida: number;
  nomPartida: string;
  tipo: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-t">
      <td className="py-2 pr-4">{codPartida}</td>
      <td className="py-2 pr-4">{nomPartida}</td>
      <td className="py-2 pr-4">
        <select
          defaultValue={tipo ?? ""}
          disabled={pending}
          onChange={(e) => startTransition(() => updatePartidaTipo(codPartida, e.target.value))}
          className="rounded border px-2 py-1 text-lg"
        >
          <option value="">Sin clasificar</option>
          <option value="ACTIVO">Activo (Balance)</option>
          <option value="PASIVO_PATRIMONIO_NETO">Pasivo / Patrimonio Neto (Balance)</option>
          <option value="RESULTADO">Resultado (Ingresos/Egresos)</option>
        </select>
      </td>
    </tr>
  );
}
