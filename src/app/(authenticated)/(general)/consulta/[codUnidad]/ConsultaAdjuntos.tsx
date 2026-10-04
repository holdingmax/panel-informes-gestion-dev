"use client";

import { useRef, useState, useTransition } from "react";
import { subirInformeAdjunto, eliminarInformeAdjunto } from "@/lib/informe-adjunto-actions";

type Adjunto = { id: string; nombreArchivo: string };

export function ConsultaAdjuntos({
  informeId,
  adjuntos,
  puedeAdjuntar,
}: {
  informeId: string;
  adjuntos: Adjunto[];
  puedeAdjuntar: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function subir(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await subirInformeAdjunto(informeId, formData);
        if (inputRef.current) inputRef.current.value = "";
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir el archivo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      {adjuntos.map((a) => (
        <div key={a.id} className="flex items-center gap-2">
          <a
            href={`/api/adjuntos/informe/${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline hover:no-underline"
          >
            {a.nombreArchivo}
          </a>
          {puedeAdjuntar && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => eliminarInformeAdjunto(a.id))}
              className="text-zinc-400 hover:text-red-600"
              title="Eliminar adjunto"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {puedeAdjuntar && (
        <form action={subir} className="mt-1 flex items-center gap-1">
          <input
            ref={inputRef}
            type="file"
            name="adjunto"
            required
            className="w-32 text-xs"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "..." : "Adjuntar"}
          </button>
        </form>
      )}

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
