"use client";

import { useActionState } from "react";
import { importBsysCombinado } from "@/lib/bsys-import";
import { openInWindow } from "@/lib/openWindow";

type ImportState = {
  error?: string;
  cuentasFaltantes?: string[];
  success?: true;
  informeId?: string;
  cantidadMes?: number;
  cantidadAcumulado?: number;
} | null;

export function BsysUploadForm({ empresaId }: { empresaId: number }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    async (_prevState, formData) => importBsysCombinado(formData),
    null
  );

  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="empresaId" value={empresaId} />

        <div className="flex gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm">Mes</span>
            <select
              name="periodoMes"
              required
              defaultValue={now.getMonth() + 1}
              className="rounded border px-3 py-2"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                <option key={mes} value={mes}>
                  {mes}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Año</span>
            <input
              name="periodoAnio"
              type="number"
              required
              defaultValue={now.getFullYear()}
              className="w-24 rounded border px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Archivo BSyS del Mes</span>
          <input name="archivoMes" type="file" required className="rounded border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Archivo BSyS Acumulado</span>
          <input
            name="archivoAcumulado"
            type="file"
            required
            className="rounded border px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Procesando..." : "Cargar y confeccionar informe"}
        </button>
      </form>

      {state?.success && (
        <div className="flex items-center gap-3 rounded border border-green-400 bg-green-50 p-3 text-sm text-green-800">
          <p>
            Se importaron {state.cantidadMes} cuentas (Mes) y {state.cantidadAcumulado} cuentas
            (Acumulado).
          </p>
          <button
            type="button"
            onClick={() =>
              openInWindow(`/empresa/${empresaId}/informe/${state.informeId}`, "informe")
            }
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            ESP y OyAF
          </button>
          <button
            type="button"
            onClick={() =>
              openInWindow(`/empresa/${empresaId}/informe/${state.informeId}/er-y-cuadros`, "er-y-cuadros")
            }
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            ER y Cuadros
          </button>
        </div>
      )}

      {state?.error && (
        <div className="text-sm text-red-600">
          <p>{state.error}</p>
          {state.cuentasFaltantes && (
            <ul className="mt-2 list-disc pl-5">
              {state.cuentasFaltantes.map((cuenta) => (
                <li key={cuenta}>{cuenta}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
