import { computeResultadoCuadro, type ResultadoColumna } from "@/lib/resultado-cuadro";
import { formatPeriodoAbrev } from "@/lib/balance-oya-report";

export const dynamic = "force-dynamic";

// INFORMES1 (la hoja de referencia) muestra todos los montos en miles de
// pesos, no en pesos completos.
function fmtParen(n: number) {
  const rounded = Math.round(n / 1000);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

type Fila = { label: string; get: (c: ResultadoColumna) => number; pct?: boolean };

const FILAS: Fila[] = [
  { label: "Ventas", get: (c) => c.ventas },
  { label: "Costos directos/variables", get: (c) => c.costosDirectos },
  { label: "Margen de Contribución", get: (c) => c.margenContribucion },
  { label: "% MC", get: (c) => c.pctMC, pct: true },
  { label: "Gastos Fijos Operativos", get: (c) => c.gastosOperativos },
  { label: "Resultado Operativo", get: (c) => c.resultadoOperativo },
  { label: "% rentabilidad Negocio", get: (c) => c.pctRentabilidadNegocio, pct: true },
  { label: "Expensas", get: (c) => c.expensas },
  { label: "Otras Ganancias y Perdidas", get: (c) => c.otrasGananciasYPerdidas },
  { label: "Rentabilidad Neta", get: (c) => c.rentabilidadNeta },
  { label: "% rentabilidad Neta", get: (c) => c.pctRentabilidadNeta, pct: true },
];

const NEGRITA = new Set(["Margen de Contribución", "Resultado Operativo", "Rentabilidad Neta"]);

export default async function ErYCuadrosPage({
  params,
}: {
  params: Promise<{ codEmp: string; informeId: string }>;
}) {
  const { informeId } = await params;
  const report = await computeResultadoCuadro(informeId);
  const { nominal } = report;

  const columnas: { label: string; datos: ResultadoColumna }[] = [
    { label: formatPeriodoAbrev(report.periodoMes, report.periodoAnio), datos: nominal.actual },
    {
      label: formatPeriodoAbrev(report.periodoMes, report.periodoAnio - 1),
      datos: nominal.mismoMesAnioAnterior,
    },
    {
      label: `Acum ${String(report.periodoAnio - 1).slice(-2)}/${String(report.periodoAnio).slice(-2)}`,
      datos: nominal.acumuladoActual,
    },
    {
      label: `Acum ${String(report.periodoAnio - 2).slice(-2)}/${String(report.periodoAnio - 1).slice(-2)}`,
      datos: nominal.acumuladoAnterior,
    },
    { label: "Promedio", datos: nominal.promedio },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-lg font-medium">
        ER y Cuadros — {formatPeriodoAbrev(report.periodoMes, report.periodoAnio)} —{" "}
        {report.empresaNombre}
      </h2>

      {report.advertencias.length > 0 && (
        <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Advertencias:</p>
          <ul className="mt-1 list-disc pl-5">
            {report.advertencias.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-lg bg-white shadow">
        <h3 className="p-4 pb-0 text-base font-medium">Nominal en Pesos (en miles de $)</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="bg-[#1f3864] text-white">
              <th className="py-2 pl-4 font-semibold">Rubro</th>
              {columnas.map((c) => (
                <th key={c.label} className="py-2 text-right font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FILAS.map((fila) => (
              <tr
                key={fila.label}
                className={`border-t border-zinc-200 ${NEGRITA.has(fila.label) ? "font-semibold" : ""}`}
              >
                <td className="py-1 pl-4">{fila.label}</td>
                {columnas.map((c) => (
                  <td key={c.label} className="py-1 pr-4 text-right">
                    {fila.pct ? fmtPct(fila.get(c.datos)) : fmtParen(fila.get(c.datos))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
        Los cuadros &quot;Ajustado por Inflación&quot; y &quot;USD&quot; (con Series e Índices)
        todavía no están armados — quedan pendientes de la explicación de esa fórmula.
      </section>
    </div>
  );
}
