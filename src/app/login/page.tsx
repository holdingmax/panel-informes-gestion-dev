"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "./actions";
import { MainBackground } from "../MainBackground";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prevState: { error?: string } | undefined, formData: FormData) =>
      login(formData),
    undefined
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <MainBackground />
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Usuario</span>
          <input
            name="username"
            type="text"
            required
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Contraseña</span>
          <input
            name="password"
            type="password"
            required
            className="rounded border px-3 py-2"
          />
        </label>

        {state?.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <Link
        href="/forgot-password"
        className="text-sm text-slate-600 underline hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Olvidé mi contraseña
      </Link>
    </main>
  );
}
