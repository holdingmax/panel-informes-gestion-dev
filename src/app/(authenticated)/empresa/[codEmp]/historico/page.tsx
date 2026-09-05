import Link from "next/link";
import { listInformes } from "@/lib/informe-actions";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const ESTADO_LABEL: Record<string, string> = {
  PROCESO: "En proceso",
  EN_REVISION: "En revisión",
  APROBADO: "Aprobado",
  DEFINITIVO: "Definitivo",
};

export default async function HistoricoPage({
  params,
}: {
  params: Promise<{ codEmp: string }>;
}) {
  const { codEmp } = await params;
  const informes = await listInformes(Number(codEmp));

  return (
    <div>
      <h2 className="text-lg font-medium">Histórico de Informes</h2>

      {informes.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">
          Todavía no hay informes. Se crean automáticamente al cargar BSyS Mes o Acumulado.
        </p>
      ) : (
        <table className="mt-4 w-full max-w-md text-left text-sm">
          <thead>
            <tr>
              <th className="py-1">Período</th>
              <th className="py-1">Estado</th>
            </tr>
          </thead>
          <tbody>
            {informes.map((informe) => (
              <tr key={informe.id} className="border-t">
                <td className="py-2">
                  <Link
                    href={`/empresa/${codEmp}/informe/${informe.id}`}
                    className="underline"
                  >
                    {MESES[informe.periodoMes - 1]} {informe.periodoAnio}
                  </Link>
                </td>
                <td className="py-2">{ESTADO_LABEL[informe.estado] ?? informe.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
