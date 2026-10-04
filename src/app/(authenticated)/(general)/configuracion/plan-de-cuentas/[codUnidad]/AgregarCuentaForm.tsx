"use client";

import { createPlanDeCuentas } from "@/lib/plan-de-cuentas-actions";

type Opcion = { id: number; nombre: string };

export function AgregarCuentaForm({
  empresas,
  rubros,
  subrubros,
  subrubros2,
  subrubros3,
  categorias,
}: {
  empresas: { codEmp: number; nombreEmp: string }[];
  rubros: Opcion[];
  subrubros: Opcion[];
  subrubros2: Opcion[];
  subrubros3: Opcion[];
  categorias: Opcion[];
}) {
  return (
    <form action={createPlanDeCuentas} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-lg">Empresa</span>
        <select name="empresaId" required className="rounded border px-3 py-2 text-lg">
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

      <label className="flex flex-col gap-1">
        <span className="text-lg">Categoría OyA (opcional)</span>
        <select name="categoriaOyAId" className="rounded border px-3 py-2 text-lg">
          <option value="">Sin clasificar</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Agregar cuenta
      </button>
    </form>
  );
}
