"use client";

import { useRef, useState, useTransition } from "react";
import { leerLineasDeExcel, type RespuestaLineasExcel } from "@/lib/reclasificacion-excel";
import type { LineaCargada } from "@/lib/reclasificacion-excel-core";

function fmt(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Botón de la carga de una reclasificación: sube un Excel con las columnas
// Cuenta, Debe y Haber para completar las líneas de golpe (útil cuando la
// reclasificación es voluminosa). El lote se controla entero contra el Plan de
// Cuentas de la empresa; si está bien, la ventana ofrece "Guardar" para pasar
// las líneas al formulario, y el resto (detalle, adjuntos, saldo) se completa a
// mano como siempre.
export function CargarLineasExcel({
  informeId,
  empresaId,
  onGuardar,
}: {
  informeId: string;
  empresaId: number;
  onGuardar: (lineas: LineaCargada[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [respuesta, setRespuesta] = useState<RespuestaLineasExcel | null>(null);

  function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    // Se vacía el input para poder volver a elegir el mismo archivo ya corregido.
    e.target.value = "";
    if (!archivo) return;

    const formData = new FormData();
    formData.set("archivo", archivo);
    startTransition(async () => {
      try {
        setRespuesta(await leerLineasDeExcel(informeId, empresaId, formData));
      } catch {
        setRespuesta({ tipo: "error", mensaje: "No se pudo procesar el archivo. Reintentá.", cuentasIncorrectas: [] });
      }
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        onChange={alElegirArchivo}
        className="hidden"
        aria-label="Archivo Excel con las cuentas, el Debe y el Haber"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        title="Cargar las cuentas con su Debe y su Haber desde un Excel (columnas Cuenta, Debe y Haber)"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Controlando archivo..." : "Cargar cuentas desde Excel"}
      </button>

      {respuesta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
          >
            {respuesta.tipo === "ok" ? (
              <>
                <div className="p-5">
                  <p className="text-lg font-medium">Archivo correcto</p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Las {respuesta.lineas.length} cuentas están en el Plan de Cuentas de la empresa y el Debe
                    es igual al Haber (<strong>{fmt(respuesta.totalDebe)}</strong>). Al guardar, se cargan en las
                    líneas del formulario (reemplazan las que haya) y seguís completando el detalle y los
                    adjuntos a mano.
                  </p>
                </div>
                <div className="flex justify-end gap-3 border-t p-4">
                  <button
                    type="button"
                    onClick={() => setRespuesta(null)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onGuardar(respuesta.lineas);
                      setRespuesta(null);
                    }}
                    className="rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover"
                  >
                    Guardar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="overflow-y-auto p-5">
                  <p className="text-lg font-medium text-red-700">No se pudo cargar el archivo</p>
                  <p className="mt-2 text-sm text-zinc-700">{respuesta.mensaje}</p>
                  {respuesta.cuentasIncorrectas.length > 0 && (
                    <ul className="mt-3 max-h-64 list-disc overflow-y-auto rounded border border-red-200 bg-red-50 p-3 pl-7 text-sm text-red-900">
                      {respuesta.cuentasIncorrectas.map((c) => (
                        <li key={`${c.fila}-${c.cuenta}`}>
                          Fila {c.fila}: {c.cuenta}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end border-t p-4">
                  <button
                    type="button"
                    onClick={() => setRespuesta(null)}
                    className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
