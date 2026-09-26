"use client";

import { useState, useTransition } from "react";

export type DeleteCheckResult = { blocked: true; reason: string } | { blocked: false };

// Botón de borrado reusado en toda Configuración: primero corre `check` (una
// server action que cuenta referencias dependientes); si hay conflicto,
// explica el motivo en vez de dejar que el borrado falle por una constraint
// de FK. Si no hay conflicto, pide una doble confirmación (verde = confirma,
// rojo = cancela) antes de llamar a `onConfirm`.
export function ConfirmDeleteButton({
  itemLabel,
  check,
  onConfirm,
}: {
  itemLabel: string;
  check: () => Promise<DeleteCheckResult>;
  onConfirm: () => Promise<void>;
}) {
  const [modal, setModal] = useState<"blocked" | "confirm" | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleDeleteClick() {
    startTransition(async () => {
      const result = await check();
      if (result.blocked) {
        setReason(result.reason);
        setModal("blocked");
      } else {
        setModal("confirm");
      }
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      setModal(null);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDeleteClick}
        disabled={pending}
        className="rounded-md border border-red-300 px-2.5 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Eliminar
      </button>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modal === "confirm" ? (
              <>
                <p className="text-lg font-medium">¿Eliminar {itemLabel}?</p>
                <p className="mt-1 text-sm text-zinc-600">Esta acción no se puede deshacer.</p>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={pending}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No se puede eliminar {itemLabel}</p>
                <p className="mt-2 text-sm text-zinc-600">{reason}</p>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
