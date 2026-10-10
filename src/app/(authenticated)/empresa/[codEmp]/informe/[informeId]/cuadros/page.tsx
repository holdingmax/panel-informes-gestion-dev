import { computeResultadoCuadro, type MesEvolucion, type ResultadoColumna } from "@/lib/resultado-cuadro";
import { ActualizarButton } from "@/components/ActualizarButton";
import { VentasRentabilidadChart } from "./VentasRentabilidadChart";

export const dynamic = "force-dynamic";

function fmtParen(n: number, enMiles: boolean) {
  const rounded = Math.round(enMiles ? n / 1000 : n);
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

// Un cuadro de evolución mensual (12 columnas) — mismas filas que el cuadro
// Nominal/Ajustado/USD de "ER" (er-y-cuadros/page.tsx), pero mes a mes en
// vez de comparar contra el mismo mes del año anterior / acumulados.
function CuadroEvolucion({
  titulo,
  meses,
  fmtValor,
}: {
  titulo: string;
  meses: MesEvolucion[];
  fmtValor: (n: number) => string;
}) {
  return (
    <section className="rounded-lg bg-white shadow">
      <h3 className="p-4 pb-0 text-base font-medium">{titulo}</h3>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="bg-[#1f3864] text-white">
              <th className="py-2 pl-4 font-semibold">Rubro</th>
              {meses.map((m) => (
                <th key={`${m.anio}-${m.mes}`} className="py-2 pr-2 text-right font-semibold">
                  {m.label}
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
                {meses.map((m) => (
                  <td key={`${m.anio}-${m.mes}`} className="py-1 pr-2 text-right">
                    {m.valores ? (fila.pct ? fmtPct(fila.get(m.valores)) : fmtValor(fila.get(m.valores))) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function CuadrosPage({
  params,
}: {
  params: Promise<{ codEmp: string; informeId: string }>;
}) {
  const { informeId } = await params;
  const report = await computeResultadoCuadro(informeId);
  const { principalCondicion, principalPorMes, secundariaPorMes } = report.evolucion12Meses;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          Cuadros — Evolución 12 meses
          {report.version > 1 && ` — versión ${report.version}`} — {report.unidadNegocioNombre}
        </h2>
        <ActualizarButton />
      </div>

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

      <div className="flex flex-col gap-3">
        <CuadroEvolucion
          titulo={`${principalCondicion} en ${report.monedaPrimariaNombre ?? "moneda primaria"}${report.presentaEnMiles ? " (en miles)" : ""}`}
          meses={principalPorMes}
          fmtValor={(n) => fmtParen(n, report.presentaEnMiles)}
        />
        {secundariaPorMes && (
          <CuadroEvolucion
            titulo={report.monedaSecundariaNombre ?? "Moneda secundaria"}
            meses={secundariaPorMes}
            fmtValor={(n) => fmtParen(n, false)}
          />
        )}
      </div>

      <section className="rounded-lg bg-white p-4 shadow">
        <h3 className="mb-2 text-base font-medium">
          Evolución Ventas y Rentabilidad Neta — últimos 12 meses ({principalCondicion})
        </h3>
        <VentasRentabilidadChart meses={principalPorMes} />
      </section>
    </div>
  );
}
