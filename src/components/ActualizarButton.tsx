"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// Re-ejecuta la consulta del Server Component sin recargar toda la página
// (router.refresh(), no window.location.reload()) — mantiene el scroll y el
// estado de los componentes cliente. Pensado para después de clasificar una
// cuenta desde el 👁 de un Rubro/Subrubro: esa pestaña no se entera sola de
// que el informe cambió hasta que se refresca.
export function ActualizarButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Actualizando..." : "Actualizar"}
    </button>
  );
}
