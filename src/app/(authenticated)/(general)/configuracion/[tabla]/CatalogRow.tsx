"use client";

import { useState, useTransition } from "react";
import { updateCatalogItem, checkDeleteCatalogItem, deleteCatalogItem } from "@/lib/catalog-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import type { CatalogKey } from "@/lib/catalogs";

export function CatalogRow({
  catalogKey,
  codigo,
  nombre,
  isAdmin,
}: {
  catalogKey: CatalogKey;
  codigo: number;
  nombre: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nombre);
  const [pending, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      await updateCatalogItem(catalogKey, codigo, value);
      setEditing(false);
    });
  }

  return (
    <tr className="border-t">
      <td className="py-2">{codigo}</td>
      <td className="py-2">
        {editing ? (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={60}
            disabled={pending}
            className="rounded border px-2 py-1 text-lg"
          />
        ) : (
          nombre
        )}
      </td>
      <td className="py-2">
        {isAdmin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={pending}
                  className="rounded-md bg-accent px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue(nombre);
                    setEditing(false);
                  }}
                  disabled={pending}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Editar
                </button>
                <ConfirmDeleteButton
                  itemLabel={`"${nombre}"`}
                  check={() => checkDeleteCatalogItem(catalogKey, codigo)}
                  onConfirm={() => deleteCatalogItem(catalogKey, codigo)}
                />
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
