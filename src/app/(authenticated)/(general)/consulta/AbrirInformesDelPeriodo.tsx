"use client";

import { openInWindow } from "@/lib/openWindow";

// Abre la ventana "Informes del período" (todas las unidades de un mes/año).
export function AbrirInformesDelPeriodo() {
  return (
    <button
      type="button"
      onClick={() => openInWindow("/consulta/periodo", "informes-del-periodo")}
      title="Ver los informes de todas las unidades de negocio de un mes y año"
      className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      Informes del período
    </button>
  );
}
