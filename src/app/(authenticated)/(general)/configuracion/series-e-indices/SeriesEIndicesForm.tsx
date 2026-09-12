"use client";

import { useActionState } from "react";
import { createSeriesEIndices } from "@/lib/series-e-indices-actions";

type FormState = { error?: string; success?: true } | null;

export function SeriesEIndicesForm({ proximoPeriodo }: { proximoPeriodo: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (_prevState, formData) => createSeriesEIndices(formData),
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-lg">Período (MM-AAAA)</span>
        <input
          name="periodo"
          required
          defaultValue={proximoPeriodo}
          pattern="\d{2}-\d{4}"
          placeholder="06-2026"
          className="rounded border px-3 py-2 text-lg"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-lg">Índice</span>
        <input
          name="indice"
          type="number"
          step="0.000001"
          required
          className="rounded border px-3 py-2 text-lg"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-lg">Dólar</span>
        <input
          name="dolar"
          type="number"
          step="0.0001"
          required
          className="rounded border px-3 py-2 text-lg"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Agregar
      </button>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Período agregado.</p>}
    </form>
  );
}
