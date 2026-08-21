"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchSecurityQuestion, submitNewPassword } from "./actions";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"username" | "reset" | "done">("username");
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleUsernameSubmit(formData: FormData) {
    setPending(true);
    const result = await fetchSecurityQuestion(formData);
    setUsername(result.username);
    setQuestion(result.question);
    setStep("reset");
    setPending(false);
  }

  async function handleResetSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submitNewPassword(formData);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStep("done");
  }

  if (step === "done") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
        <p>Tu contraseña fue actualizada. Ya podés iniciar sesión.</p>
        <Link href="/login" className="text-sm underline">
          Ir a iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Olvidé mi contraseña</h1>

      {step === "username" && (
        <form action={handleUsernameSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm">Usuario</span>
            <input
              name="username"
              type="text"
              required
              className="rounded border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            Continuar
          </button>
        </form>
      )}

      {step === "reset" && (
        <form action={handleResetSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="username" value={username} />
          <p className="text-sm">{question}</p>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Respuesta</span>
            <input
              name="answer"
              type="text"
              required
              className="rounded border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Nueva contraseña</span>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              className="rounded border px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            Cambiar contraseña
          </button>
        </form>
      )}

      <Link href="/login" className="text-sm underline">
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
