import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">Sistema de Confección de Informes de Gestión</h1>
        <p className="text-lg text-zinc-600">
          Sesión iniciada como <strong>{session?.user.name}</strong> ({session?.user.role})
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <Link
          href="/consulta"
          className="flex w-64 flex-col items-center justify-center gap-2 rounded-lg bg-white p-10 text-center shadow-lg transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <span className="text-xl font-semibold text-slate-800">CONSULTA</span>
        </Link>
        <Link
          href="/preparacion-informes"
          className="flex w-64 flex-col items-center justify-center gap-2 rounded-lg bg-white p-10 text-center shadow-lg transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <span className="text-xl font-semibold text-slate-800">PREPARACIÓN DE INFORMES</span>
        </Link>
      </div>
    </main>
  );
}
