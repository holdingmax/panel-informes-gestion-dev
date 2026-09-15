import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MESES_ABREV = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function fmt(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

export default async function ResultadosHistoricosPage({
  params,
}: {
  params: Promise<{ codEmp: string }>;
}) {
  const { codEmp } = await params;
  const unidadNegocioId = Number(codEmp);

  const filas = await prisma.resultadosHistoricos.findMany({
    where: { unidadNegocioId },
    orderBy: [{ periodoAnio: "desc" }, { periodoMes: "desc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Resultados Históricos</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Valores nominales por mes que alimentan los cuadros de ER y Cuadros (Ventas, Costos
          Directos, Gastos Operativos, Expensas y Otras Ganancias y Pérdidas). Se cargan a mano
          para períodos anteriores al sistema, y automáticamente al aprobar cada informe — este
          listado es solo para controlar lo que quedó guardado.
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-zinc-600">Todavía no hay períodos cargados.</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto rounded-lg bg-white shadow">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="py-2 pl-4 pr-4">Período</th>
                <th className="py-2 pr-4 text-right">Ventas</th>
                <th className="py-2 pr-4 text-right">Costos Directos</th>
                <th className="py-2 pr-4 text-right">Gastos Operativos</th>
                <th className="py-2 pr-4 text-right">Expensas</th>
                <th className="py-2 pr-4 text-right">Otras Ganancias y Pérdidas</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-t border-zinc-100">
                  <td className="py-1.5 pl-4 pr-4">
                    {MESES_ABREV[f.periodoMes - 1]}-{f.periodoAnio}
                  </td>
                  <td className="py-1.5 pr-4 text-right">{fmt(Number(f.ventas))}</td>
                  <td className="py-1.5 pr-4 text-right">{fmt(Number(f.costosDirectos))}</td>
                  <td className="py-1.5 pr-4 text-right">{fmt(Number(f.gastosOperativos))}</td>
                  <td className="py-1.5 pr-4 text-right">{fmt(Number(f.expensas))}</td>
                  <td className="py-1.5 pr-4 text-right">
                    {fmt(Number(f.otrasGananciasYPerdidas))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
