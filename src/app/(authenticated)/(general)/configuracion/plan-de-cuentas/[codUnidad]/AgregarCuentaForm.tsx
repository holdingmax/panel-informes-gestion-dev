"use client";

import { useState } from "react";
import { createPlanDeCuentas } from "@/lib/plan-de-cuentas-actions";

type Opcion = { id: number; nombre: string };

export function AgregarCuentaForm({
  empresas,
  rubros,
  subrubros,
  subrubros2,
  subrubros3,
  unidadActualId,
}: {
  empresas: { codEmp: number; nombreEmp: string; comparteBsys: boolean; unidades: Opcion[] }[];
  rubros: Opcion[];
  subrubros: Opcion[];
  subrubros2: Opcion[];
  subrubros3: Opcion[];
  // Unidad cuyo Plan de Cuentas se está mirando: es la que se propone como
  // Cuit compartido al agregar una cuenta de una Empresa compartida.
  unidadActualId: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState("");
  const empresa = empresas.find((e) => String(e.codEmp) === empresaId);

  async function agregar(formData: FormData) {
    const result = await createPlanDeCuentas(formData);
    setError(result?.error ?? null);
  }

  return (
    <form action={agregar} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-lg">Empresa</span>
        <select
          name="empresaId"
          required
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className="rounded border px-3 py-2 text-lg"
        >
          <option value="">Seleccionar...</option>
          {empresas.map((empresa) => (
            <option key={empresa.codEmp} value={empresa.codEmp}>
              {empresa.nombreEmp}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-lg">Cuenta (hasta 90 caracteres)</span>
        <input name="cuenta" required maxLength={90} className="rounded border px-3 py-2 text-lg" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-lg">Rubro (ESP, opcional)</span>
        <select name="rubroId" className="rounded border px-3 py-2 text-lg">
          <option value="">Sin clasificar</option>
          {rubros.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-lg">Subrubro (ER, opcional)</span>
        <select name="subrubroId" className="rounded border px-3 py-2 text-lg">
          <option value="">Sin clasificar</option>
          {subrubros.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-lg">Subrubro 2 (opcional)</span>
        <select name="subrubro2Id" className="rounded border px-3 py-2 text-lg">
          <option value="">Sin clasificar</option>
          {subrubros2.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-lg">Subrubro 3 (opcional)</span>
        <select name="subrubro3Id" className="rounded border px-3 py-2 text-lg">
          <option value="">Sin clasificar</option>
          {subrubros3.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>

      {empresa?.comparteBsys && (
        <label className="flex flex-col gap-1">
          <span className="text-lg">Cuit compartido (unidad a la que pertenece la cuenta)</span>
          <select
            key={empresa.codEmp}
            name="unidadNegocioId"
            required
            defaultValue={empresa.unidades.some((u) => u.id === unidadActualId) ? unidadActualId : ""}
            className="rounded border px-3 py-2 text-lg"
          >
            <option value="">Seleccionar...</option>
            {empresa.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Agregar cuenta
      </button>
    </form>
  );
}
