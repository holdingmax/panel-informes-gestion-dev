"use client";

import { useActionState } from "react";
import { actualizarEmpresasVinculadas } from "@/lib/unidad-negocio-actions";

type EmpresaOpcion = { codEmp: number; nombreEmp: string };

export function EmpresasVinculadasForm({
  codUnidad,
  empresas,
  vinculadasIds,
}: {
  codUnidad: number;
  empresas: EmpresaOpcion[];
  vinculadasIds: number[];
}) {
  const [, formAction, pending] = useActionState<null, FormData>(async (_prev, formData) => {
    await actualizarEmpresasVinculadas(formData);
    return null;
  }, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="codUnidad" value={codUnidad} />
      <select
        name="empresaIds"
        multiple
        defaultValue={vinculadasIds.map(String)}
        className="h-24 min-w-48 rounded border px-2 py-1 text-sm"
      >
        {empresas.map((e) => (
          <option key={e.codEmp} value={e.codEmp}>
            {e.nombreEmp}
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
