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

function GroupHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={4} className="pt-4 pb-1 text-sm font-semibold uppercase text-zinc-700">
        {label}
      </td>
    </tr>
  );
}

function BalanceRows({ rows }: { rows: RubroLine[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.codRubro} className="border-t">
          <td className="py-1 pl-3">{r.nombre}</td>
          <td className="py-1 text-right">{fmt(r.saldoFinal)}</td>
          <td className="py-1 text-right">{fmt(r.saldoInicio)}</td>
          <td className="py-1 text-right">{fmtParen(r.origenAplicacion)}</td>
        </tr>
      ))}
    </>
  );
}

// En la columna "Aplicaciones" se invierte el signo: ahí el caso normal (el
// rubro creció) da origenAplicacion negativo, así que para mostrar el valor
// esperado en positivo (y una reversión en negativo/paréntesis) hay que dar
// vuelta el signo — ver el comentario en balance-oya-report.ts.
function OrigenAplicacionRows({ rows, aplicacion }: { rows: RubroLine[]; aplicacion?: boolean }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.codRubro} className="border-t">
          <td className="py-1">{r.nombre}</td>
          <td className="py-1 text-right">
            {fmtParen(aplicacion ? -r.origenAplicacion : r.origenAplicacion)}
          </td>
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
  const { balance, origenAplicacion, nof, resultadoDelPeriodo, ajustesEjerciciosAnteriores } = report;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          Informe {MESES[report.periodoMes - 1]} {report.periodoAnio} — {report.empresaNombre}
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

      {/* Hoja 2: Estado de Situación Patrimonial */}
      <section className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-base font-medium">Estado de Situación Patrimonial</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-1 font-medium">Rubro</th>
              <th className="py-1 text-right font-medium">Saldo Final</th>
              <th className="py-1 text-right font-medium">Saldo Inicio</th>
              <th className="py-1 text-right font-medium">Origen (Aplicación)</th>
            </tr>
          </thead>
          <tbody>
            <GroupHeader label="Activo" />
            <BalanceRows rows={balance.activo} />
            <tr className="border-t-2 font-medium">
              <td className="py-1">Total Activo</td>
              <td className="py-1 text-right">{fmt(balance.totalActivo)}</td>
              <td className="py-1" />
              <td className="py-1" />
            </tr>

            <GroupHeader label="Pasivo y Patrimonio Neto" />
            <BalanceRows rows={balance.pasivoYPatrimonioNeto} />
            <tr className="border-t-2 font-medium">
              <td className="py-1">Total Pasivo + Patrimonio Neto</td>
              <td className="py-1 text-right">{fmt(balance.totalPasivoPN)}</td>
              <td className="py-1" />
              <td className="py-1" />
            </tr>

            <tr className="border-t">
              <td className="py-1">Resultado del Ejercicio</td>
              <td className="py-1 text-right">{fmt(resultadoDelPeriodo)}</td>
              <td className="py-1" />
              <td className="py-1" />
            </tr>
            <tr className="border-t-2 font-semibold">
              <td className="py-1">Total Pasivo + Patrimonio Neto + Resultado</td>
              <td className="py-1 text-right">
                {fmt(balance.totalPasivoPN + resultadoDelPeriodo)}
              </td>
              <td className="py-1" />
              <td className="py-1" />
            </tr>
          </tbody>
        </table>
      </section>

      {/* Hoja 4: Estado de Origen y Aplicación de Fondos */}
      <section className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-base font-medium">Estado de Origen y Aplicación de Fondos</h3>
        <div className="mt-2 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h4 className="border-b pb-1 text-sm font-medium">Orígenes</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                <OrigenAplicacionRows rows={origenAplicacion.origenes} />
                {resultadoDelPeriodo > 0 && (
                  <tr className="border-t">
                    <td className="py-1">Resultado del Ejercicio</td>
                    <td className="py-1 text-right">{fmt(resultadoDelPeriodo)}</td>
                  </tr>
                )}
                {ajustesEjerciciosAnteriores > 0 && (
                  <tr className="border-t">
                    <td className="py-1">Ajustes Ejercicios Anteriores</td>
                    <td className="py-1 text-right">{fmt(ajustesEjerciciosAnteriores)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-1 flex justify-between border-t-2 py-1 text-sm font-medium">
              <span>Total Orígenes</span>
              <span>{fmt(origenAplicacion.totalOrigenes)}</span>
            </p>
          </div>
          <div>
            <h4 className="border-b pb-1 text-sm font-medium">Aplicaciones</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                <OrigenAplicacionRows rows={origenAplicacion.aplicaciones} aplicacion />
                {resultadoDelPeriodo < 0 && (
                  <tr className="border-t">
                    <td className="py-1">Resultado del Ejercicio</td>
                    <td className="py-1 text-right">{fmt(-resultadoDelPeriodo)}</td>
                  </tr>
                )}
                {ajustesEjerciciosAnteriores < 0 && (
                  <tr className="border-t">
                    <td className="py-1">Ajustes Ejercicios Anteriores</td>
                    <td className="py-1 text-right">{fmt(-ajustesEjerciciosAnteriores)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-1 flex justify-between border-t-2 py-1 text-sm font-medium">
              <span>Total Aplicaciones</span>
              <span>{fmt(origenAplicacion.totalAplicaciones)}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Hoja 5: Necesidades Operativas de Fondos */}
      <section className="rounded-lg bg-white p-4 shadow">
        <h3 className="text-base font-medium">
          Necesidades Operativas de Fondos y Otros Orígenes (Aplicaciones)
        </h3>

        <div className="mt-2 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h4 className="border-b pb-1 text-sm font-medium">Capital de Trabajo (Operativo)</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                {nof.operativo.map((r) => (
                  <tr key={r.codRubro} className="border-t">
                    <td className="py-1">{r.nombre}</td>
                    <td className="py-1 text-right">{fmtParen(r.origenAplicacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 flex justify-between border-t-2 py-1 text-sm font-medium">
              <span>Aumento (Disminución) NCT</span>
              <span>{fmtParen(nof.totalOperativo)}</span>
            </p>
          </div>

          <div>
            <h4 className="border-b pb-1 text-sm font-medium">No Operativo</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                {nof.noOperativo.map((r) => (
                  <tr key={r.codRubro} className="border-t">
                    <td className="py-1">{r.nombre}</td>
                    <td className="py-1 text-right">{fmtParen(r.origenAplicacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 flex justify-between border-t-2 py-1 text-sm font-medium">
              <span>Origen (Aplicación) No Operativas</span>
              <span>{fmtParen(nof.totalNoOperativo)}</span>
            </p>
          </div>

          <div>
            <h4 className="border-b pb-1 text-sm font-medium">Financiamiento Propio</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                {nof.financiamiento.map((r) => (
                  <tr key={r.codRubro} className="border-t">
                    <td className="py-1">{r.nombre}</td>
                    <td className="py-1 text-right">{fmtParen(r.origenAplicacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 flex justify-between border-t-2 py-1 text-sm font-medium">
              <span>Excedente (Necesidad) Financiamiento</span>
              <span>{fmtParen(nof.totalFinanciamiento)}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1 text-sm">
          <p className="flex justify-between">
            <span>Resultado del Ejercicio</span>
            <span>{fmt(resultadoDelPeriodo)}</span>
          </p>
          <p className="flex justify-between">
            <span>Aumento (Disminución) Necesidades de Capital de Trabajo (NOF)</span>
            <span>{fmtParen(nof.totalOperativo)}</span>
          </p>
          <p className="flex justify-between border-t-2 pt-1 font-semibold">
            <span>Resultado vs NOF</span>
            <span>{fmtParen(nof.resultadoVsNOF)}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
