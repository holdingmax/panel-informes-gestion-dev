"use client";

import { useState, useTransition } from "react";
import { editUserAction, deleteUserAction } from "./actions";

const BOTON =
  "rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function EditDeleteUser({
  id,
  username,
  role,
}: {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submitEdit(formData: FormData) {
    const nuevoUsername = String(formData.get("username") ?? "");
    const nuevoRole = formData.get("role") === "ADMIN" ? "ADMIN" : "USER";
    startTransition(async () => {
      const result = await editUserAction(id, nuevoUsername, nuevoRole);
      if ("error" in result) {
        setError(result.error);
      } else {
        setError(null);
        setEditing(false);
      }
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteUserAction(id);
      if ("error" in result) {
        setError(result.error);
        setConfirmingDelete(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v);
            setConfirmingDelete(false);
            setError(null);
          }}
          className={BOTON}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirmingDelete((v) => !v);
            setEditing(false);
            setError(null);
          }}
          className={`${BOTON} text-red-700`}
        >
          Eliminar
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {editing && (
        <form action={submitEdit} className="flex items-end gap-2 rounded border bg-zinc-50 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm">Usuario</span>
            <input
              name="username"
              required
              defaultValue={username}
              className="rounded border px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Rol</span>
            <select name="role" defaultValue={role} className="rounded border px-2 py-1">
              <option value="USER">Usuario</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-2.5 py-1.5 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      )}

      {confirmingDelete && (
        <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm">
          <span>
            ¿Eliminar a <strong>{username}</strong>? Se borran también sus permisos. No se puede deshacer.
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={confirmDelete}
            className="rounded-md bg-red-700 px-2.5 py-1.5 text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Eliminar
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)} className={BOTON}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
