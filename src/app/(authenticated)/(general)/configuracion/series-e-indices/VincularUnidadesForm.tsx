"use client";

import { useState, useTransition } from "react";
import { vincularUnidadesATabla } from "@/lib/series-e-indices-actions";

type UnidadOpcion = { codUnidad: number; nombreUnidad: string; seriesTablaId: number | null };

const BOTON_PRIMARIO =
  "rounded-md bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const BOTON_SECUNDARIO =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

// Administra qué Unidades de Negocio usan una tabla de Series e Índices. Las
// vinculadas se ven siempre como una lista; para sumar una se la busca y se la
// agrega, para sacarla se aprieta la ✕. Los cambios quedan marcados como
// pendientes y recién se aplican con "Guardar cambios". Una unidad solo puede
// usar una tabla a la vez: las que ya usan OTRA tabla aparecen bloqueadas (no
// se pueden agregar) hasta que se las saque de la otra.
export function VincularUnidadesForm({
  codTabla,
  unidades,
  vinculadasIds,
  nombresDeTablas,
}: {
  codTabla: number;
  unidades: UnidadOpcion[];
  vinculadasIds: number[];
  nombresDeTablas: Record<number, string>;
}) {
  const [seleccion, setSeleccion] = useState<Set<number>>(() => new Set(vinculadasIds));
  const [busqueda, setBusqueda] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const originales = new Set(vinculadasIds);
  const porId = new Map(unidades.map((u) => [u.codUnidad, u]));
  const agregadas = [...seleccion].filter((id) => !originales.has(id));
  const quitadas = [...originales].filter((id) => !seleccion.has(id));
  const hayCambios = agregadas.length > 0 || quitadas.length > 0;
  const enOtraTabla = (u: UnidadOpcion) => u.seriesTablaId !== null && u.seriesTablaId !== codTabla;

  const nombre = (id: number) => porId.get(id)?.nombreUnidad ?? `Unidad ${id}`;
  const vinculadasAhora = unidades.filter((u) => seleccion.has(u.codUnidad));
  const termino = busqueda.trim().toLowerCase();
  // Primero las que se pueden agregar, después las bloqueadas por usar otra tabla.
  const disponibles = unidades
    .filter((u) => !seleccion.has(u.codUnidad) && (termino === "" || u.nombreUnidad.toLowerCase().includes(termino)))
    .sort((a, b) => Number(enOtraTabla(a)) - Number(enOtraTabla(b)));

  function cambiar(id: number, vinculada: boolean) {
    setGuardado(false);
    setError(null);
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (vinculada) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  function guardar() {
    const formData = new FormData();
    formData.set("codTabla", String(codTabla));
    for (const id of seleccion) formData.append("unidadIds", String(id));
    startTransition(async () => {
      try {
        const resultado = await vincularUnidadesATabla(formData);
        if (resultado?.error) {
          setError(resultado.error);
          return;
        }
        setGuardado(true);
        setError(null);
      } catch {
        setError("No se pudieron guardar los cambios. Reintentá.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Unidades vinculadas */}
      <div>
        <p className="mb-2 text-sm font-medium">
          Usan esta tabla ({vinculadasAhora.length} de {unidades.length} unidades)
        </p>
        {vinculadasAhora.length === 0 ? (
          <p className="text-sm text-zinc-600">Ninguna unidad usa esta tabla todavía.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {vinculadasAhora.map((u) => {
              const nueva = !originales.has(u.codUnidad);
              return (
                <li
                  key={u.codUnidad}
                  className={`flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 text-sm ${
                    nueva ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-50 text-slate-800"
                  }`}
                >
                  <span>
                    {u.nombreUnidad}
                    {nueva && <span className="ml-1 text-xs font-medium">(nueva, sin guardar)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => cambiar(u.codUnidad, false)}
                    disabled={pending}
                    aria-label={`Quitar ${u.nombreUnidad} de esta tabla`}
                    title="Quitar de esta tabla"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Agregar unidades */}
      <div>
        <p className="mb-2 text-sm font-medium">Agregar unidades</p>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar unidad de negocio..."
          aria-label="Buscar unidad de negocio"
          className="mb-2 w-full max-w-sm rounded border px-3 py-1.5 text-sm"
        />
        {disponibles.length === 0 ? (
          <p className="text-sm text-zinc-600">
            {termino ? "Ninguna unidad coincide con la búsqueda." : "Todas las unidades ya usan esta tabla."}
          </p>
        ) : (
          <ul className="max-h-56 max-w-xl divide-y overflow-y-auto rounded border">
            {disponibles.map((u) => {
              const bloqueada = enOtraTabla(u);
              const otra = bloqueada ? (nombresDeTablas[u.seriesTablaId as number] ?? "otra tabla") : null;
              return (
                <li
                  key={u.codUnidad}
                  className={`flex items-center justify-between gap-3 px-3 py-1.5 text-sm ${bloqueada ? "bg-zinc-50 text-zinc-500" : ""}`}
                >
                  <span>
                    {u.nombreUnidad}
                    <span className="ml-2 text-xs">
                      {bloqueada ? `ya usa «${otra}»: sacala de esa tabla para poder agregarla` : "sin tabla asignada"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => cambiar(u.codUnidad, true)}
                    disabled={pending || bloqueada}
                    aria-label={
                      bloqueada
                        ? `${u.nombreUnidad} no se puede agregar: ya usa «${otra}»`
                        : `Agregar ${u.nombreUnidad} a esta tabla`
                    }
                    title={bloqueada ? `Ya usa «${otra}»: una unidad usa una sola tabla` : undefined}
                    className={BOTON_SECUNDARIO}
                  >
                    {bloqueada ? "No disponible" : "+ Agregar"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Cambios pendientes */}
      {hayCambios && (
        <div role="status" className="max-w-xl rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Hay cambios sin guardar</p>
          {agregadas.length > 0 && <p>Agregás: {agregadas.map(nombre).join(", ")}.</p>}
          {quitadas.length > 0 && <p>Quitás: {quitadas.map(nombre).join(", ")}.</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={guardar} disabled={pending} className={BOTON_PRIMARIO}>
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSeleccion(new Set(vinculadasIds));
                setError(null);
              }}
              disabled={pending}
              className={BOTON_SECUNDARIO}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {guardado && !hayCambios && (
        <p role="status" className="text-sm text-emerald-700">
          Cambios guardados.
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
