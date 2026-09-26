"use client";

import { useState } from "react";
import { PlanDeCuentaRow } from "./PlanDeCuentaRow";

type Opcion = { id: number; nombre: string };

type Fila = {
  id: string;
  empresaId: number;
  nombreEmpresa: string;
  cuenta: string;
  partidaPatrimonialId: number;
  rubroId: number;
  subrubroId: number;
  subrubro2Id: number | null;
  subrubro3Id: number | null;
  categoriaOyAId: number | null;
  nombrePartida: string;
  nombreRubro: string;
  nombreSubrubro: string;
  nombreSubrubro2: string | null;
  nombreSubrubro3: string | null;
  nombreCategoriaOyA: string | null;
};

export function PlanDeCuentasTable({
  filas,
  empresas,
  partidas,
  rubros,
  subrubros,
  subrubros2,
  subrubros3,
  categorias,
}: {
  filas: Fila[];
  empresas: { codEmp: number; nombreEmp: string }[];
  partidas: Opcion[];
  rubros: Opcion[];
  subrubros: Opcion[];
  subrubros2: Opcion[];
  subrubros3: Opcion[];
  categorias: Opcion[];
}) {
  const [filtroEmpresa, setFiltroEmpresa] = useState("");

  const filasFiltradas = filtroEmpresa
    ? filas.filter((f) => f.empresaId === Number(filtroEmpresa))
    : filas;

  return (
    <div className="flex flex-col gap-3">
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
                partidaPatrimonialId={f.partidaPatrimonialId}
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
                partidas={partidas}
                rubros={rubros}
                subrubros={subrubros}
                subrubros2={subrubros2}
                subrubros3={subrubros3}
                categorias={categorias}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
