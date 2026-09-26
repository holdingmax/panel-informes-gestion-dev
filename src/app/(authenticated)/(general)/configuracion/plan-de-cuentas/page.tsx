import Link from "next/link";
import { listUnidadesNegocioConEmpresas } from "@/lib/unidad-negocio-actions";

export const dynamic = "force-dynamic";

export default async function PlanDeCuentasPage() {
  const unidades = await listUnidadesNegocioConEmpresas();

  return (
    <main className="flex w-full max-w-2xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Plan de Cuentas</h1>

      <p className="text-sm text-zinc-600">
        Elegí una Unidad de Negocio para ver el Plan de Cuentas de cada una de sus Empresas.
      </p>

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Unidad de Negocio</th>
              <th className="py-1">Empresas</th>
            </tr>
          </thead>
          <tbody>
            {unidades.map((unidad) => (
              <tr key={unidad.codUnidad} className="border-t">
                <td className="py-2 pr-4">{unidad.codUnidad}</td>
                <td className="py-2 pr-4">
                  <Link
                    href={`/configuracion/plan-de-cuentas/${unidad.codUnidad}`}
                    className="underline hover:text-accent"
                  >
                    {unidad.nombreUnidad}
                  </Link>
                </td>
                <td className="py-2 text-sm text-zinc-600">
                  {unidad.empresas.length > 0
                    ? unidad.empresas.map((e) => e.nombreEmp).join(", ")
                    : "— sin empresas vinculadas —"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
