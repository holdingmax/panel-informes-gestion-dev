"use client";

import { useActionState } from "react";
import { importBsys } from "@/lib/bsys-import";

type ImportState = {
  error?: string;
  cuentasFaltantes?: string[];
  success?: true;
  cantidad?: number;
} | null;

export function BsysUploadForm({
  empresaId,
  tipo,
}: {
  empresaId: number;
  tipo: "MES" | "ACUMULADO";
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    async (_prevState, formData) => importBsys(formData),
    null
  );

  const now = new Date();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="empresaId" value={empresaId} />
      <input type="hidden" name="tipo" value={tipo} />

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
        <span className="text-sm">Archivo del sistema contable</span>
        <input name="archivo" type="file" required className="rounded border px-3 py-2" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Procesando..." : "Cargar"}
      </button>

      {state?.success && (
        <p className="text-sm text-green-700">
          Se importaron {state.cantidad} cuentas correctamente.
        </p>
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
    </form>
  );
}
