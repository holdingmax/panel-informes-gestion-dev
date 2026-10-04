"use client";

import { openInWindow } from "@/lib/openWindow";

export function AvisoCuentasSinClasificar({
  mensaje,
  url,
  windowName,
}: {
  mensaje: string;
  url: string;
  windowName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="font-medium">{mensaje}</p>
      <button
        type="button"
        onClick={() => openInWindow(url, windowName)}
        className="shrink-0 rounded-md border border-amber-600 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        Ver cuentas
      </button>
    </div>
  );
}
