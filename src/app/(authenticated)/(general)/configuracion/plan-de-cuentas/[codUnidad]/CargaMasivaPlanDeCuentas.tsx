"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { cargaMasivaPlanDeCuentas, type RespuestaCargaMasiva } from "@/lib/plan-de-cuentas-carga-masiva";
import type { Conflicto, Resolucion } from "@/lib/plan-de-cuentas-carga-masiva-core";

const VACIAR = "__vaciar__";

type Resultado = Extract<RespuestaCargaMasiva, { tipo: "resultado" }>;

function ResultadoCarga({ r }: { r: Resultado }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
        Se cargaron <strong>{r.cargadas}</strong> cuenta(s) de {r.totalFilas} del archivo.
      </p>

      {r.descartadasExistentes > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
          Se descartaron <strong>{r.descartadasExistentes}</strong> cuenta(s) por ya existir en la base
          (mismos números al comienzo del nombre en la misma empresa)
          {r.ejemplosExistentes.length > 0 && <>, por ejemplo: {r.ejemplosExistentes.join("; ")}</>}. Si
          necesitan hacer cambios en esas cuentas, háganlos manualmente con Editar/Eliminar.
        </p>
      )}

      {r.errores.length > 0 && (
        <details className="rounded border border-red-300 bg-red-50 p-3 text-red-900" open>
          <summary className="cursor-pointer font-medium">
            Se descartaron {r.errores.length + r.erroresOmitidos} cuenta(s) por errores
          </summary>
          <ul className="mt-2 max-h-64 list-disc overflow-y-auto pl-5">
            {r.errores.map((e) => (
              <li key={`${e.fila}-${e.motivo}`}>
                Fila {e.fila}
                {e.cuenta ? ` (${e.cuenta})` : ""}: {e.motivo}
              </li>
            ))}
            {r.erroresOmitidos > 0 && <li>…y {r.erroresOmitidos} más.</li>}
          </ul>
        </details>
      )}
    </div>
  );
}

function VentanaConflictos({
  conflictos,
  elecciones,
  onElegir,
  onContinuar,
  onCancelar,
  pending,
}: {
  conflictos: Conflicto[];
  elecciones: Record<string, string>;
  onElegir: (clave: string, valor: string) => void;
  onContinuar: () => void;
  onCancelar: () => void;
  pending: boolean;
}) {
  const completo = conflictos.every((c) => elecciones[c.clave]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conflictos de la carga inicial"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
      >
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Carga inicial: valores a resolver</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Esta empresa todavía no tiene cuentas. Algunos valores del archivo no existen en las tablas
            de referencia: elegí, para cada caso, entre los valores vigentes. Al continuar se cierra esta
            ventana y se hace la carga.
          </p>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {conflictos.map((c) => (
            <div key={c.clave} className="rounded border border-slate-200 p-3">
              <p className="text-sm font-medium">{c.mensaje}</p>
              <p className="text-xs text-zinc-500">
                {c.filas.length} fila(s) del archivo (fila {c.filas.slice(0, 8).join(", ")}
                {c.filas.length > 8 ? "…" : ""})
              </p>
              <select
                value={elecciones[c.clave] ?? ""}
                onChange={(e) => onElegir(c.clave, e.target.value)}
                disabled={pending}
                aria-label={c.mensaje}
                className="mt-2 w-full rounded border px-2 py-1.5 text-sm"
              >
                <option value="">Elegir una opción…</option>
                {c.opciones.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
                {c.etiquetaVaciar && <option value={VACIAR}>{c.etiquetaVaciar}</option>}
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t p-4">
          <button
            type="button"
            onClick={onCancelar}
            disabled={pending}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onContinuar}
            disabled={!completo || pending}
            className="rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Cargando..." : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CargaMasivaPlanDeCuentas({ codUnidad }: { codUnidad: number }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [conflictos, setConflictos] = useState<Conflicto[] | null>(null);
  const [elecciones, setElecciones] = useState<Record<string, string>>({});

  function enviar(resoluciones?: Record<string, Resolucion>) {
    if (!archivo) {
      setError("Seleccioná un archivo Excel.");
      return;
    }
    const formData = new FormData();
    formData.set("codUnidad", String(codUnidad));
    formData.set("archivo", archivo);
    if (resoluciones) formData.set("resoluciones", JSON.stringify(resoluciones));

    startTransition(async () => {
      try {
        const r = await cargaMasivaPlanDeCuentas(formData);
        if (r.tipo === "error") {
          setError(r.mensaje);
          setResultado(null);
          setConflictos(null);
        } else if (r.tipo === "conflictos") {
          setError(null);
          setResultado(null);
          setConflictos(r.conflictos);
          // Se conservan las elecciones ya hechas que siguen vigentes.
          setElecciones((prev) =>
            Object.fromEntries(r.conflictos.map((c) => [c.clave, prev[c.clave] ?? ""]))
          );
        } else {
          setError(null);
          setConflictos(null);
          setResultado(r);
          router.refresh();
        }
      } catch {
        setError("No se pudo procesar el archivo. Reintentá; si persiste, revisá que sea un Excel válido.");
      }
    });
  }

  function continuar() {
    if (!conflictos) return;
    const resoluciones: Record<string, Resolucion> = {};
    for (const c of conflictos) {
      const e = elecciones[c.clave];
      resoluciones[c.clave] = e === VACIAR ? { accion: "vaciar" } : { accion: "usar", valor: e };
    }
    enviar(resoluciones);
  }

  return (
    <CollapsibleAdd label="Carga masiva">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">
          Sube un Excel con las columnas <strong>Empresa, Cuenta, Partida, Rubro, Subrubro, Subrubro 2,
          Subrubro 3</strong> (todas pueden estar vacías menos Cuenta, que tiene que empezar con la secuencia
          de números del sistema contable). Solo se cargan las cuentas que todavía no existen. Descargá
          tablas-actuales para armar el archivo: trae los valores vigentes de cada tabla.
        </p>

        <a
          href={`/api/plan-de-cuentas/${codUnidad}/referencia`}
          className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Descargar tablas-actuales
        </a>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Archivo Excel (.xlsx)</span>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setResultado(null);
              setError(null);
            }}
            className="rounded border px-3 py-2 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => enviar()}
          disabled={pending || !archivo}
          className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && !conflictos ? "Procesando..." : "Cargar cuentas"}
        </button>

        {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {resultado && <ResultadoCarga r={resultado} />}
      </div>

      {conflictos && (
        <VentanaConflictos
          conflictos={conflictos}
          elecciones={elecciones}
          onElegir={(clave, valor) => setElecciones((prev) => ({ ...prev, [clave]: valor }))}
          onContinuar={continuar}
          onCancelar={() => {
            setConflictos(null);
            setElecciones({});
          }}
          pending={pending}
        />
      )}
    </CollapsibleAdd>
  );
}
