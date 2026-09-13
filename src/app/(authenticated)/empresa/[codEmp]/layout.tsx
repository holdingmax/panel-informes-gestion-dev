import { notFound } from "next/navigation";
import Link from "next/link";
import { getEmpresa } from "@/lib/empresa-actions";

export const dynamic = "force-dynamic";

export default async function EmpresaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ codEmp: string }>;
}) {
  const { codEmp } = await params;
  const empresa = await getEmpresa(Number(codEmp));
  if (!empresa) notFound();

  const backgroundStyle = empresa.imagenMime
    ? {
        backgroundImage: `url(/api/empresas/${empresa.codEmp}/logo)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }
    : undefined;

  return (
    <div style={backgroundStyle} className="min-h-screen bg-zinc-100">
      <div className="min-h-screen bg-white/85">
        <header className="flex flex-wrap items-center gap-4 border-b bg-white/90 p-4">
          <h1 className="text-lg font-semibold">{empresa.nombreEmp}</h1>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/empresa/${empresa.codEmp}/confeccionar-informe`}
              className="rounded-md px-3 py-1.5 text-slate-700 underline hover:bg-slate-50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Confeccionar Informe
            </Link>
            <Link
              href={`/empresa/${empresa.codEmp}/historico`}
              className="rounded-md px-3 py-1.5 text-slate-700 underline hover:bg-slate-50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Histórico de Informes
            </Link>
            <Link
              href={`/empresa/${empresa.codEmp}/resultados-historicos`}
              className="rounded-md px-3 py-1.5 text-slate-700 underline hover:bg-slate-50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Resultados Históricos
            </Link>
          </nav>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
