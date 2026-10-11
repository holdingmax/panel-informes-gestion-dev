"use client";

import { useState, useTransition } from "react";
import { toggleActiveAction } from "./actions";

export function ToggleActiveButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleActiveAction(id, !active);
            setError("error" in result ? result.error : null);
          })
        }
        className="w-fit rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {active ? "Desactivar" : "Activar"}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
