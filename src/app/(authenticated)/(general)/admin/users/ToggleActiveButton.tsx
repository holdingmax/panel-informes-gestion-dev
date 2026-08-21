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
      className="rounded border px-2 py-1 text-sm disabled:opacity-50"
    >
      {active ? "Desactivar" : "Activar"}
    </button>
  );
}
