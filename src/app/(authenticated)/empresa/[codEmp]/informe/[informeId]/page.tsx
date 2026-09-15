import { computeInformeReport, type RubroLine } from "@/lib/balance-oya-report";
import { InformeActions } from "./InformeActions";

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

function fmt(n: number) {
  return Math.round(n).toLocaleString("es-AR");
}

// Convención contable: los negativos se muestran entre paréntesis.
function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : fmt(rounded);
}

function BalanceRows({ rows }: { rows: RubroLine[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.codRubro} className="border-t border-zinc-200">
          <td className="py-1 pl-3">{r.nombre}</td>
          <td className="py-1 text-right">{fmtParen(r.saldoFinal)}</td>
          <td className="py-1 text-right">{fmtParen(r.saldoInicio)}</td>
          <td className="py-1 text-right">{fmtParen(r.variacion)}</td>
        </tr>
      ))}
    </>
  );
}

function TotalRow({
  label,
  final,
  inicio,
}: {
  label: string;
  final: number;
  inicio: number;
}) {
  return (
    <tr className="border-t-2 border-zinc-400 font-semibold">
      <td className="py-1">{label}</td>
      <td className="py-1 text-right">{fmtParen(final)}</td>
      <td className="py-1 text-right">{fmtParen(inicio)}</td>
      <td className="py-1" />
    </tr>
  );
}

function Spacer() {
  return (
    <tr>
      <td colSpan={4} className="py-2" />
    </tr>
  );
}

function OrigenAplicacionRows({ rows }: { rows: RubroLine[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.codRubro} className="border-t border-zinc-200">
          <td className="py-1">{r.nombre}</td>
          <td className="py-1 text-right">{fmtParen(r.origenAplicacion)}</td>
        </tr>
      ))}
    </>
  );
}

export default async function InformeDetallePage({
  params,
}: {
  params: Promise<{ codEmp: string; informeId: string }>;
}) {
  const { informeId } = await params;
  const report = await computeInformeReport(informeId);
  const {
    balance,
    origenAplicacion,
    nof,
    resultadoDelPeriodo,
    resultadoInicioNoDistribuido,
    resultadosAcumuladosSDifPatrimonial,
  } = report;
  const controlOrigenAplicacion = balance.control - balance.controlAnterior;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          Informe {MESES[report.periodoMes - 1]} {report.periodoAnio} — {report.unidadNegocioNombre}
        </h2>
        <InformeActions informeId={report.informeId} estado={report.estado} />
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

      {/* Hoja 2: Estado Patrimonial - Origen y Aplicación de Fondos */}
      <section className="rounded-lg bg-white shadow">
        <h3 className="p-4 pb-0 text-base font-medium">
          Estado Patrimonial - Origen y Aplicación de Fondos
        </h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="bg-[#1f3864] text-white">
              <th className="py-2 pl-4 font-semibold">Rubro</th>
              <th className="py-2 text-right font-semibold">{report.periodoLabel}</th>
              <th className="py-2 text-right font-semibold">{report.periodoAnteriorLabel}</th>
              <th className="py-2 pr-4 text-right font-semibold">Origen (Aplicación)</th>
            </tr>
          </thead>
          <tbody>
            <BalanceRows rows={balance.activo} />
            <TotalRow
              label="Total Activo"
              final={balance.totalActivo}
              inicio={balance.totalActivoAnterior}
            />
            <Spacer />
            <BalanceRows rows={balance.pasivo} />
            <TotalRow
              label="Total Pasivo"
              final={balance.totalPasivo}
              inicio={balance.totalPasivoAnterior}
            />
            <Spacer />
            <BalanceRows rows={balance.patrimonioNeto} />
            <TotalRow
              label="Total Patrimonio Neto"
              final={balance.totalPatrimonioNeto}
              inicio={balance.totalPatrimonioNetoAnterior}
            />
            <tr className="bg-yellow-200 font-semibold">
              <td className="py-1 pl-4">Control</td>
              <td className="py-1 text-right">{fmtParen(balance.control)}</td>
              <td className="py-1 text-right">{fmtParen(balance.controlAnterior)}</td>
              <td className="py-1 pr-4 text-right">{fmtParen(controlOrigenAplicacion)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Hoja 4: Estado de Origen y Aplicación de Fondos */}
      <section className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-base font-medium">Estado de Origen y Aplicación de Fondos</h3>

        <table className="mt-3 w-full max-w-md text-left text-sm">
          <tbody>
            <tr className="bg-blue-50">
              <td className="py-1 pl-2 font-medium">Resultados Acumulados S/Indicadores</td>
              <td className="py-1 pr-2 text-right font-medium">{fmtParen(resultadoDelPeriodo)}</td>
            </tr>
            {origenAplicacion.ajustes.map((a) => (
              <tr key={a.codRubro} className="bg-blue-50">
                <td className="py-1 pl-2">Ajustes Ejercicios Anteriores ({a.nombre})</td>
                <td className="py-1 pr-2 text-right">{fmtParen(a.origenAplicacion)}</td>
              </tr>
            ))}
            {resultadoInicioNoDistribuido !== 0 && (
              <tr className="bg-blue-50">
                <td className="py-1 pl-2">Resultado no distribuido al inicio del ejercicio</td>
                <td className="py-1 pr-2 text-right">{fmtParen(resultadoInicioNoDistribuido)}</td>
              </tr>
            )}
            <tr className="border-t border-zinc-400 bg-blue-50 font-semibold">
              <td className="py-1 pl-2">Resultados Acumulados S/Dif. Patrimonial</td>
              <td className="py-1 pr-2 text-right">
                {fmtParen(resultadosAcumuladosSDifPatrimonial)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h4 className="border-b pb-1 text-sm font-medium">Orígenes de Fondos</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                <OrigenAplicacionRows rows={origenAplicacion.origenes} />
              </tbody>
            </table>
            <p className="mt-1 flex justify-between border-t-2 border-zinc-400 py-1 text-sm font-semibold">
              <span>Total de Orígenes</span>
              <span>{fmtParen(origenAplicacion.totalOrigenes)}</span>
            </p>
          </div>
          <div>
            <h4 className="border-b pb-1 text-sm font-medium">Aplicaciones de Fondos</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                <OrigenAplicacionRows rows={origenAplicacion.aplicaciones} />
              </tbody>
            </table>
            <p className="mt-1 flex justify-between border-t-2 border-zinc-400 py-1 text-sm font-semibold">
              <span>Total Aplicaciones</span>
              <span>{fmtParen(origenAplicacion.totalAplicaciones)}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Hoja 5: Necesidades Operativas de Fondos */}
      <section className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-base font-medium">
          Necesidades Operativas de Fondos y Otros Orígenes (Aplicaciones)
        </h3>

        <table className="mt-3 w-full max-w-lg text-left text-sm">
          <tbody>
            <tr>
              <td className="py-1">Resultados Acumulados S/Indicadores</td>
              <td className="py-1 text-right">{fmtParen(resultadoDelPeriodo)}</td>
            </tr>
            {origenAplicacion.ajustes.map((a) => (
              <tr key={a.codRubro}>
                <td className="py-1">Ajustes Ejercicios Anteriores ({a.nombre})</td>
                <td className="py-1 text-right">{fmtParen(a.origenAplicacion)}</td>
              </tr>
            ))}
            {resultadoInicioNoDistribuido !== 0 && (
              <tr>
                <td className="py-1">Resultado no distribuido al inicio del ejercicio</td>
                <td className="py-1 text-right">{fmtParen(resultadoInicioNoDistribuido)}</td>
              </tr>
            )}
            <tr>
              <td className="py-1">Aumento (Disminución) Necesidades de Capital de Trabajo (NOF)</td>
              <td className="py-1 text-right">{fmtParen(nof.totalOperativo)}</td>
            </tr>
            <tr className="border-t-2 border-zinc-400 font-semibold">
              <td className="py-1">Resultado vs NOF</td>
              <td className="py-1 text-right">{fmtParen(nof.resultadoVsNOF)}</td>
            </tr>

            <Spacer />

            {nof.noOperativo.map((r) => (
              <tr key={r.codRubro}>
                <td className="py-1">{r.nombre}</td>
                <td className="py-1 text-right">{fmtParen(r.origenAplicacion)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-400 font-semibold">
              <td className="py-1">Origen (Aplicación) No Operativas</td>
              <td className="py-1 text-right">{fmtParen(nof.totalNoOperativo)}</td>
            </tr>

            <Spacer />

            {nof.financiamiento.map((r) => (
              <tr key={r.codRubro}>
                <td className="py-1">{r.nombre}</td>
                <td className="py-1 text-right">{fmtParen(r.origenAplicacion)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-400 font-semibold">
              <td className="py-1">Excedente (Necesidad) Financiamiento Propio</td>
              <td className="py-1 text-right">{fmtParen(nof.totalFinanciamiento)}</td>
            </tr>

            <tr className="bg-yellow-200 font-semibold">
              <td className="py-1 pl-2">Control</td>
              <td className="py-1 pr-2 text-right">{fmtParen(nof.control)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
