"use client";

import { useActionState, useState } from "react";
import { importBsysCombinado } from "@/lib/bsys-import";
import { openInWindow } from "@/lib/openWindow";

type ImportState = {
  error?: string;
  empresaNombre?: string;
  cuentasFaltantes?: string[];
  success?: true;
  informeId?: string;
  version?: number;
  detalle?: { empresaNombre: string; cantidadMes: number; cantidadAcumulado: number }[];
} | null;

type EmpresaDeUnidad = { codEmp: number; nombreEmp: string };

export function BsysUploadForm({
  unidadNegocioId,
  empresas,
  cuentasPorEmpresa,
}: {
  unidadNegocioId: number;
  empresas: EmpresaDeUnidad[];
  cuentasPorEmpresa: Record<number, string[]>;
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    async (_prevState, formData) => importBsysCombinado(formData),
    null
  );
  const [refundicionPendiente, setRefundicionPendiente] = useState(false);

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

        <fieldset className="flex flex-col gap-2 rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Archivo BSyS del Mes</legend>
          {empresas.map((empresa) => (
            <div key={empresa.codEmp} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">{empresa.nombreEmp}</span>
              <input
                name={`archivoMes_${empresa.codEmp}`}
                type="file"
                required
                className="rounded border px-3 py-2"
              />
            </div>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Archivo BSyS Acumulado</legend>
          {empresas.map((empresa) => (
            <div key={empresa.codEmp} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">{empresa.nombreEmp}</span>
              <input
                name={`archivoAcumulado_${empresa.codEmp}`}
                type="file"
                required
                className="rounded border px-3 py-2"
              />
            </div>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Refundición pendiente</legend>
          <p className="text-xs text-zinc-500">
            Marcá &quot;Sí&quot; solo si el sistema contable de origen todavía no posteó el
            asiento de cierre de ejercicio: el Acumulado de cada empresa se ajusta para llevar a
            cero el saldo de inicio de sus cuentas de Ingresos y Egresos, imputando la
            contrapartida a la cuenta de RNA que indiques.
          </p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="refundicionPendienteChoice"
                value="no"
                checked={!refundicionPendiente}
                onChange={() => setRefundicionPendiente(false)}
              />
              <span>No</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="refundicionPendienteChoice"
                value="si"
                checked={refundicionPendiente}
                onChange={() => setRefundicionPendiente(true)}
              />
              <span>Sí</span>
            </label>
          </div>
          {refundicionPendiente && (
            <>
              <input type="hidden" name="refundicionPendiente" value="on" />
              <div className="flex flex-col gap-2">
                {empresas.map((empresa) => (
                  <label key={empresa.codEmp} className="flex flex-col gap-1">
                    <span className="text-sm">Cuenta de RNA de {empresa.nombreEmp}</span>
                    <select
                      name={`cuentaRNA_${empresa.codEmp}`}
                      required
                      defaultValue=""
                      className="rounded border px-3 py-2"
                    >
                      <option value="" disabled>
                        Seleccionar...
                      </option>
                      {(cuentasPorEmpresa[empresa.codEmp] ?? []).map((cuenta) => (
                        <option key={cuenta} value={cuenta}>
                          {cuenta}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          )}
        </fieldset>

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
          {state.version && state.version > 1 && (
            <p className="font-medium">
              Ya existía un informe Aprobado para este período — se creó la versión {state.version}.
            </p>
          )}
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
