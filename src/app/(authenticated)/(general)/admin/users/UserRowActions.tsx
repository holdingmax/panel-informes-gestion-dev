"use client";

import { useState, useTransition } from "react";
import { resetPasswordAction, resetSecurityQuestionAction } from "./actions";

export function UserRowActions({ id }: { id: string }) {
  const [open, setOpen] = useState<"password" | "security" | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submitPassword(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    startTransition(async () => {
      await resetPasswordAction(id, newPassword);
      setMessage("Contraseña actualizada.");
      setOpen(null);
    });
  }

  function submitSecurityQuestion(formData: FormData) {
    const securityQuestion = String(formData.get("securityQuestion") ?? "");
    const securityAnswer = String(formData.get("securityAnswer") ?? "");
    startTransition(async () => {
      await resetSecurityQuestionAction(id, securityQuestion, securityAnswer);
      setMessage("Pregunta de seguridad actualizada.");
      setOpen(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(open === "password" ? null : "password")}
          className="rounded border px-2 py-1 text-sm"
        >
          Restablecer contraseña
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "security" ? null : "security")}
          className="rounded border px-2 py-1 text-sm"
        >
          Cambiar pregunta de seguridad
        </button>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}

      {open === "password" && (
        <form
          action={submitPassword}
          className="flex items-end gap-2 rounded border bg-zinc-50 p-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm">Nueva contraseña</span>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              className="rounded border px-2 py-1"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      )}

      {open === "security" && (
        <form
          action={submitSecurityQuestion}
          className="flex items-end gap-2 rounded border bg-zinc-50 p-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm">Pregunta de seguridad</span>
            <input name="securityQuestion" required className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Respuesta</span>
            <input name="securityAnswer" required className="rounded border px-2 py-1" />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      )}
    </div>
  );
}
