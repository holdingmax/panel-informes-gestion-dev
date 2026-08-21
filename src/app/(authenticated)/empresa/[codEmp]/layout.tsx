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
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-zinc-500">Confeccionar Informe:</span>
            <Link href={`/empresa/${empresa.codEmp}/bsys-mes`} className="underline">
              Carga de BSyS Mes
            </Link>
            <Link
              href={`/empresa/${empresa.codEmp}/bsys-acumulado`}
              className="underline"
            >
              Carga de BSyS Acumulado
            </Link>
            <Link href={`/empresa/${empresa.codEmp}/historico`} className="underline">
              Histórico de Informes
            </Link>
          </nav>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
