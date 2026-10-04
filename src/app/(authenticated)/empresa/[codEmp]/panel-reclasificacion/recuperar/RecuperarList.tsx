"use client";

import { useState, useTransition } from "react";
import { copiarReclasificacion } from "@/lib/reclasificacion-actions";

type ReclasificacionItem = {
  id: string;
  numero: number;
  periodoLabel: string;
  detalle: string;
  lineas: { planDeCuenta: { cuenta: string }; debe: string; haber: string }[];
  adjuntos: { nombreArchivo: string }[];
};

export function RecuperarList({
  items,
  informeDestinoId,
}: {
  items: ReclasificacionItem[];
  informeDestinoId: string;
}) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-zinc-600">Esta empresa no tiene reclasificaciones en otros períodos.</p>;
  }

  function copiar() {
    if (!seleccionada) return;
    startTransition(async () => {
      await copiarReclasificacion(seleccionada, informeDestinoId);
      setCopiada(true);
    });
  }

  if (copiada) {
    return (
      <p className="text-sm text-emerald-700">
        Reclasificación copiada al informe que estás trabajando. Ya podés cerrar esta ventana.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <label
            key={item.id}
            className={`flex cursor-pointer flex-col gap-1 rounded border p-3 text-sm ${
              seleccionada === item.id ? "border-accent bg-accent/5" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="reclasificacion"
                checked={seleccionada === item.id}
                onChange={() => setSeleccionada(item.id)}
              />
              <span className="font-medium">
                #{item.numero} — {item.periodoLabel}
              </span>
            </div>
            <p className="pl-6 text-zinc-700">{item.detalle}</p>
            <ul className="pl-6 text-xs text-zinc-500">
              {item.lineas.map((l, i) => (
                <li key={i}>
                  {l.planDeCuenta.cuenta}: Debe {l.debe} / Haber {l.haber}
                </li>
              ))}
            </ul>
            {item.adjuntos.length > 0 && (
              <p className="pl-6 text-xs text-zinc-500">
                Adjuntos: {item.adjuntos.map((a) => a.nombreArchivo).join(", ")}
              </p>
            )}
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={!seleccionada || pending}
        onClick={copiar}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold uppercase text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Copiando..." : "Copiar"}
      </button>
    </div>
  );
}
