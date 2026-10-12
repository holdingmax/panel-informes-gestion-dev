"use client";

import { useState } from "react";
import { PlanDeCuentaRow } from "./PlanDeCuentaRow";

type Opcion = { id: number; nombre: string };

type Fila = {
  id: string;
  empresaId: number;
  nombreEmpresa: string;
  cuenta: string;
  rubroId: number | null;
  subrubroId: number | null;
  subrubro2Id: number | null;
  subrubro3Id: number | null;
  unidadNegocioId: number | null;
  nombrePartida: string | null;
  nombreRubro: string | null;
  nombreSubrubro: string | null;
  nombreSubrubro2: string | null;
  nombreSubrubro3: string | null;
  nombreUnidadCuenta: string | null;
};

type EmpresaOpcion = {
  codEmp: number;
  nombreEmp: string;
  comparteBsys: boolean;
  unidades: Opcion[];
};

export function PlanDeCuentasTable({
  filas,
  empresas,
  rubros,
  subrubros,
  subrubros2,
  subrubros3,
  puedeConfiguracion,
}: {
  filas: Fila[];
  empresas: EmpresaOpcion[];
  rubros: Opcion[];
  subrubros: Opcion[];
  subrubros2: Opcion[];
  subrubros3: Opcion[];
  puedeConfiguracion: boolean;
}) {
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("");
  const [filtroSubrubro, setFiltroSubrubro] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");

  // La columna y el filtro "Cuit compartido" solo tienen sentido si alguna
  // de las Empresas comparte BSyS.
  const hayCompartidas = empresas.some((e) => e.comparteBsys);
  const unidadesCompartidas = [
    ...new Map(
      empresas.filter((e) => e.comparteBsys).flatMap((e) => e.unidades).map((u) => [u.id, u])
    ).values(),
  ];

  const cuentaNormalizada = filtroCuenta.trim().toLowerCase();

  const filasFiltradas = filas.filter((f) => {
    if (filtroEmpresa && f.empresaId !== Number(filtroEmpresa)) return false;
    if (cuentaNormalizada && !f.cuenta.toLowerCase().includes(cuentaNormalizada)) return false;
    if (filtroRubro && f.rubroId !== Number(filtroRubro)) return false;
    if (filtroSubrubro && f.subrubroId !== Number(filtroSubrubro)) return false;
    if (filtroUnidad && f.unidadNegocioId !== Number(filtroUnidad)) return false;
    return true;
  });

  const hayFiltrosActivos =
    filtroEmpresa || filtroCuenta || filtroRubro || filtroSubrubro || filtroUnidad;

  function limpiarFiltros() {
    setFiltroEmpresa("");
    setFiltroCuenta("");
    setFiltroRubro("");
    setFiltroSubrubro("");
    setFiltroUnidad("");
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

        {hayCompartidas && (
          <label className="flex w-fit flex-col gap-1">
            <span className="text-sm">Filtrar por cuit compartido</span>
            <select
              value={filtroUnidad}
              onChange={(e) => setFiltroUnidad(e.target.value)}
              className="rounded border px-3 py-2 text-lg"
            >
              <option value="">Todos</option>
              {unidadesCompartidas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

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
              {hayCompartidas && <th className="py-1 pr-4">Cuit compartido</th>}
              <th className="py-1 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.map((f) => {
              const empresa = empresas.find((e) => e.codEmp === f.empresaId);
              return (
              <PlanDeCuentaRow
                key={f.id}
                id={f.id}
                nombreEmpresa={f.nombreEmpresa}
                cuenta={f.cuenta}
                rubroId={f.rubroId}
                subrubroId={f.subrubroId}
                subrubro2Id={f.subrubro2Id}
                subrubro3Id={f.subrubro3Id}
                unidadNegocioId={f.unidadNegocioId}
                nombrePartida={f.nombrePartida}
                nombreRubro={f.nombreRubro}
                nombreSubrubro={f.nombreSubrubro}
                nombreSubrubro2={f.nombreSubrubro2}
                nombreSubrubro3={f.nombreSubrubro3}
                nombreUnidadCuenta={f.nombreUnidadCuenta}
                rubros={rubros}
                subrubros={subrubros}
                subrubros2={subrubros2}
                subrubros3={subrubros3}
                comparteBsys={empresa?.comparteBsys ?? false}
                unidadesDeEmpresa={empresa?.unidades ?? []}
                mostrarCuitCompartido={hayCompartidas}
                puedeConfiguracion={puedeConfiguracion}
              />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
