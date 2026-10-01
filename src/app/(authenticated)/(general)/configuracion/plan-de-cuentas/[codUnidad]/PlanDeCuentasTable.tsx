"use client";

import { useState } from "react";
import { PlanDeCuentaRow } from "./PlanDeCuentaRow";

type Opcion = { id: number; nombre: string };
type RubroOpcion = Opcion & { esResultado: boolean };

type Fila = {
  id: string;
  empresaId: number;
  nombreEmpresa: string;
  cuenta: string;
  rubroId: number;
  subrubroId: number | null;
  subrubro2Id: number | null;
  subrubro3Id: number | null;
  categoriaOyAId: number | null;
  nombrePartida: string | null;
  nombreRubro: string;
  nombreSubrubro: string | null;
  nombreSubrubro2: string | null;
  nombreSubrubro3: string | null;
  nombreCategoriaOyA: string | null;
};

export function PlanDeCuentasTable({
  filas,
  empresas,
  rubros,
  subrubros,
  subrubros2,
  subrubros3,
  categorias,
  isAdmin,
}: {
  filas: Fila[];
  empresas: { codEmp: number; nombreEmp: string }[];
  rubros: RubroOpcion[];
  subrubros: Opcion[];
  subrubros2: Opcion[];
  subrubros3: Opcion[];
  categorias: Opcion[];
  isAdmin: boolean;
}) {
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("");
  const [filtroSubrubro, setFiltroSubrubro] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const cuentaNormalizada = filtroCuenta.trim().toLowerCase();

  const filasFiltradas = filas.filter((f) => {
    if (filtroEmpresa && f.empresaId !== Number(filtroEmpresa)) return false;
    if (cuentaNormalizada && !f.cuenta.toLowerCase().includes(cuentaNormalizada)) return false;
    if (filtroRubro && f.rubroId !== Number(filtroRubro)) return false;
    if (filtroSubrubro && f.subrubroId !== Number(filtroSubrubro)) return false;
    if (filtroCategoria && f.categoriaOyAId !== Number(filtroCategoria)) return false;
    return true;
  });

  const hayFiltrosActivos =
    filtroEmpresa || filtroCuenta || filtroRubro || filtroSubrubro || filtroCategoria;

  function limpiarFiltros() {
    setFiltroEmpresa("");
    setFiltroCuenta("");
    setFiltroRubro("");
    setFiltroSubrubro("");
    setFiltroCategoria("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex w-fit flex-col gap-1">
          <span className="text-sm">Buscar cuenta</span>
          <input
            value={filtroCuenta}
            onChange={(e) => setFiltroCuenta(e.target.value)}
            placeholder="Código o nombre..."
            className="rounded border px-3 py-2 text-lg"
          />
        </label>

        <label className="flex w-fit flex-col gap-1">
          <span className="text-sm">Filtrar por empresa</span>
          <select
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
            className="rounded border px-3 py-2 text-lg"
          >
            <option value="">Todas</option>
            {empresas.map((e) => (
              <option key={e.codEmp} value={e.codEmp}>
                {e.nombreEmp}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-fit flex-col gap-1">
          <span className="text-sm">Filtrar por rubro</span>
          <select
            value={filtroRubro}
            onChange={(e) => setFiltroRubro(e.target.value)}
            className="rounded border px-3 py-2 text-lg"
          >
            <option value="">Todos</option>
            {rubros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-fit flex-col gap-1">
          <span className="text-sm">Filtrar por subrubro</span>
          <select
            value={filtroSubrubro}
            onChange={(e) => setFiltroSubrubro(e.target.value)}
            className="rounded border px-3 py-2 text-lg"
          >
            <option value="">Todos</option>
            {subrubros.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-fit flex-col gap-1">
          <span className="text-sm">Filtrar por categoría OyA</span>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="rounded border px-3 py-2 text-lg"
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <p className="text-sm text-zinc-600">
        {filasFiltradas.length} de {filas.length} cuenta(s)
      </p>

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead>
            <tr>
              <th className="py-1 pr-4">Empresa</th>
              <th className="py-1 pr-4">Cuenta</th>
              <th className="py-1 pr-4">Partida</th>
              <th className="py-1 pr-4">Rubro</th>
              <th className="py-1 pr-4">Subrubro</th>
              <th className="py-1 pr-4">Subrubro 2</th>
              <th className="py-1 pr-4">Subrubro 3</th>
              <th className="py-1 pr-4">Categoría OyA</th>
              <th className="py-1 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.map((f) => (
              <PlanDeCuentaRow
                key={f.id}
                id={f.id}
                nombreEmpresa={f.nombreEmpresa}
                cuenta={f.cuenta}
                rubroId={f.rubroId}
                subrubroId={f.subrubroId}
                subrubro2Id={f.subrubro2Id}
                subrubro3Id={f.subrubro3Id}
                categoriaOyAId={f.categoriaOyAId}
                nombrePartida={f.nombrePartida}
                nombreRubro={f.nombreRubro}
                nombreSubrubro={f.nombreSubrubro}
                nombreSubrubro2={f.nombreSubrubro2}
                nombreSubrubro3={f.nombreSubrubro3}
                nombreCategoriaOyA={f.nombreCategoriaOyA}
                rubros={rubros}
                subrubros={subrubros}
                subrubros2={subrubros2}
                subrubros3={subrubros3}
                categorias={categorias}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
