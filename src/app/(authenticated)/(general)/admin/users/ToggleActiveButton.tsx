"use client";

import { useTransition } from "react";
import { toggleActiveAction } from "./actions";

export function ToggleActiveButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleActiveAction(id, !active))}
      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {active ? "Desactivar" : "Activar"}
    </button>
  );
}
