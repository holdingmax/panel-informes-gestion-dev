import { auth } from "@/auth";
import { listEmpresas } from "@/lib/empresa-actions";
import { EmpresaGrid } from "../../EmpresaGrid";

export default async function Home() {
  const session = await auth();
  const empresas = await listEmpresas();

  return (
    <main className="flex w-full flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">
        Sistema de Confección de Informes de Gestión
      </h1>

      <p className="text-lg text-zinc-600">
        Sesión iniciada como <strong>{session?.user.name}</strong> (
        {session?.user.role})
      </p>

      <EmpresaGrid empresas={empresas} />
    </main>
  );
}
