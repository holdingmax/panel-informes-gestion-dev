"use client";

import { useActionState } from "react";
import { importBsysCombinado } from "@/lib/bsys-import";
import { openInWindow } from "@/lib/openWindow";

type ImportState = {
  error?: string;
  empresaNombre?: string;
  cuentasFaltantes?: string[];
  success?: true;
  informeId?: string;
  detalle?: { empresaNombre: string; cantidadMes: number; cantidadAcumulado: number }[];
} | null;

type EmpresaDeUnidad = { codEmp: number; nombreEmp: string };

export function BsysUploadForm({
  unidadNegocioId,
  empresas,
}: {
  unidadNegocioId: number;
  empresas: EmpresaDeUnidad[];
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    async (_prevState, formData) => importBsysCombinado(formData),
    null
  );

  const now = new Date();

  if (empresas.length === 0) {
    return (
      <p className="text-sm text-red-600">
        Esta unidad de negocio no tiene empresas vinculadas. Vinculá al menos una en
        Configuración → Unidades de Negocio.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="unidadNegocioId" value={unidadNegocioId} />
        {empresas.map((empresa) => (
          <input key={empresa.codEmp} type="hidden" name="empresaId" value={empresa.codEmp} />
        ))}

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

        <div className="flex flex-col gap-3">
          {empresas.map((empresa) => (
            <div
              key={empresa.codEmp}
              className="flex flex-col gap-2 rounded border border-slate-200 p-3 sm:flex-row sm:items-end sm:gap-4"
            >
              <span className="w-full shrink-0 text-sm font-medium sm:w-48">
                {empresa.nombreEmp}
              </span>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-sm">Archivo BSyS del Mes</span>
                <input
                  name={`archivoMes_${empresa.codEmp}`}
                  type="file"
                  required
                  className="rounded border px-3 py-2"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-sm">Archivo BSyS Acumulado</span>
                <input
                  name={`archivoAcumulado_${empresa.codEmp}`}
                  type="file"
                  required
                  className="rounded border px-3 py-2"
                />
              </label>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Procesando..." : "Cargar y confeccionar informe"}
        </button>
      </form>

      {state?.success && (
        <div className="flex flex-col gap-3 rounded border border-green-400 bg-green-50 p-3 text-sm text-green-800">
          <ul className="list-disc pl-5">
            {state.detalle?.map((d) => (
              <li key={d.empresaNombre}>
                {d.empresaNombre}: {d.cantidadMes} cuentas (Mes), {d.cantidadAcumulado} cuentas
                (Acumulado)
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                openInWindow(`/empresa/${unidadNegocioId}/informe/${state.informeId}`, "informe")
              }
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              ESP y OyAF
            </button>
            <button
              type="button"
              onClick={() =>
                openInWindow(
                  `/empresa/${unidadNegocioId}/informe/${state.informeId}/er-y-cuadros`,
                  "er-y-cuadros"
                )
              }
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              ER y Cuadros
            </button>
          </div>
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
