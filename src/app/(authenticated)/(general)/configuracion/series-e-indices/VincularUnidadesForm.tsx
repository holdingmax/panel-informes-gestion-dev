"use client";

import { useActionState } from "react";
import { vincularUnidadesATabla } from "@/lib/series-e-indices-actions";

type UnidadOpcion = { codUnidad: number; nombreUnidad: string };

export function VincularUnidadesForm({
  codTabla,
  unidades,
  vinculadasIds,
}: {
  codTabla: number;
  unidades: UnidadOpcion[];
  vinculadasIds: number[];
}) {
  const [, formAction, pending] = useActionState<null, FormData>(async (_prev, formData) => {
    await vincularUnidadesATabla(formData);
    return null;
  }, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="codTabla" value={codTabla} />
      <select
        name="unidadIds"
        multiple
        defaultValue={vinculadasIds.map(String)}
        className="h-24 min-w-48 rounded border px-2 py-1 text-sm"
      >
        {unidades.map((u) => (
          <option key={u.codUnidad} value={u.codUnidad}>
            {u.nombreUnidad}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );
}
