"use client";

import { useState } from "react";

// Antes, cada página de Configuración mostraba el formulario de alta siempre
// abierto arriba de la tabla. Ahora arranca colapsado detrás de un botón, y
// se cierra solo tras un alta exitosa (para no dejarlo abierto con datos
// viejos) si el padre pasa closeSignal.
export function CollapsibleAdd({
  label = "Agregar",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {open ? "Cancelar" : label}
      </button>
      {open && <div className="rounded-lg bg-white p-6 shadow">{children}</div>}
    </div>
  );
}
