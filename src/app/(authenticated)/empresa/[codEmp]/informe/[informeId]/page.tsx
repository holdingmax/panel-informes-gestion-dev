import { auth } from "@/auth";
import { computeInformeReport, type RubroLine } from "@/lib/balance-oya-report";
import { permisosDeUnidad } from "@/lib/authz";
import { InformeActions } from "./InformeActions";
import { RubroRowActions } from "./RubroRowActions";
import { AvisoCuentasSinClasificar } from "./AvisoCuentasSinClasificar";

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

function BalanceRows({
  rows,
  codEmp,
  informeId,
  isAdmin,
  soloLectura,
}: {
  rows: RubroLine[];
  codEmp: string;
  informeId: string;
  isAdmin: boolean;
  soloLectura: boolean;
}) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.codRubro} className="border-t border-zinc-200">
          <td className="py-1 pl-3">
            <span className="inline-flex items-center gap-2">
              {r.nombre}
              {r.codRubro !== -1 && (
                <RubroRowActions
                  codEmp={codEmp}
                  informeId={informeId}
                  codRubro={r.codRubro}
                  bucketNOF={r.bucketNOF}
                  isAdmin={isAdmin}
                  soloLectura={soloLectura}
                />
              )}
            </span>
          </td>
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

// "Resultados Acumulados" (resultadoDelPeriodo + resultadoInicioNoDistribuido,
// siempre un Origen — ver origenAplicacionDe en balance-oya-report.ts) tiene
// que quedar en la MISMA columna que el resto de los Orígenes, para que su
// importe esté en línea vertical con los que arman el Total de Orígenes de
// abajo — antes se mostraba en una tabla aparte, desalineada de esa columna.
function ResultadosAcumuladosRows({
  resultadoDelPeriodo,
  resultadoInicioNoDistribuido,
  resultadosAcumuladosSDifPatrimonial,
}: {
  resultadoDelPeriodo: number;
  resultadoInicioNoDistribuido: number;
  resultadosAcumuladosSDifPatrimonial: number;
}) {
  return (
    <>
      <tr className="bg-blue-50">
        <td className="py-1">Resultados Acumulados S/Indicadores</td>
        <td className="py-1 text-right">{fmtParen(resultadoDelPeriodo)}</td>
      </tr>
      {resultadoInicioNoDistribuido !== 0 && (
        <tr className="bg-blue-50">
          <td className="py-1">Resultado no distribuido al inicio del ejercicio</td>
          <td className="py-1 text-right">{fmtParen(resultadoInicioNoDistribuido)}</td>
        </tr>
      )}
      <tr className="border-t border-zinc-400 bg-blue-50 font-semibold">
        <td className="py-1">Resultados Acumulados S/Dif. Patrimonial</td>
        <td className="py-1 text-right">{fmtParen(resultadosAcumuladosSDifPatrimonial)}</td>
      </tr>
    </>
  );
}

export default async function InformeDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ codEmp: string; informeId: string }>;
  searchParams: Promise<{ soloLectura?: string }>;
}) {
  const { codEmp, informeId } = await params;
  const { soloLectura: soloLecturaParam } = await searchParams;
  const soloLectura = soloLecturaParam === "1";
  const report = await computeInformeReport(informeId);
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const permisos = await permisosDeUnidad(report.unidadNegocioId);
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
          Informe {MESES[report.periodoMes - 1]} {report.periodoAnio}
          {report.version > 1 && ` — versión ${report.version}`} — {report.unidadNegocioNombre}
        </h2>
        <InformeActions
          informeId={report.informeId}
          estado={report.estado}
          puedeRevisar={permisos.puedeRevisar}
          puedeAprobar={permisos.puedeAprobar}
          soloLectura={soloLectura}
        />
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

      {report.cuentasSinRubro.length > 0 && (
        <AvisoCuentasSinClasificar
          mensaje={`HAY CUENTAS SIN VALORES EN RUBRO (${report.cuentasSinRubro.length})`}
          url={`/empresa/${codEmp}/informe/${informeId}/sin-rubro${soloLectura ? "?soloLectura=1" : ""}`}
          windowName={`sin-rubro-${informeId}`}
        />
      )}

      {/* Hoja 2: Estado Patrimonial - Origen y Aplicación de Fondos */}
      <section className="rounded-lg bg-white shadow">
        <h3 className="p-4 pb-0 text-base font-medium">
          Estado Patrimonial - Origen y Aplicación de Fondos
        </h3>
        <table className="mt-2 table-fixed text-left text-sm">
          <thead>
            <tr className="bg-[#1f3864] text-white">
              <th className="w-56 py-2 pl-4 font-semibold">Rubro</th>
              <th className="w-28 py-2 text-right font-semibold">{report.periodoLabel}</th>
              <th className="w-28 py-2 text-right font-semibold">{report.periodoAnteriorLabel}</th>
              <th className="w-32 py-2 pr-4 text-right font-semibold">Origen (Aplicación)</th>
            </tr>
          </thead>
          <tbody>
            <BalanceRows rows={balance.activo} codEmp={codEmp} informeId={informeId} isAdmin={isAdmin} soloLectura={soloLectura} />
            <TotalRow
              label="Total Activo"
              final={balance.totalActivo}
              inicio={balance.totalActivoAnterior}
            />
            <Spacer />
            <BalanceRows rows={balance.pasivo} codEmp={codEmp} informeId={informeId} isAdmin={isAdmin} soloLectura={soloLectura} />
            <TotalRow
              label="Total Pasivo"
              final={balance.totalPasivo}
              inicio={balance.totalPasivoAnterior}
            />
            <Spacer />
            <BalanceRows rows={balance.patrimonioNeto} codEmp={codEmp} informeId={informeId} isAdmin={isAdmin} soloLectura={soloLectura} />
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

        <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h4 className="border-b pb-1 text-sm font-medium">Orígenes de Fondos</h4>
            <table className="w-full text-left text-sm">
              <tbody>
                <ResultadosAcumuladosRows
                  resultadoDelPeriodo={resultadoDelPeriodo}
                  resultadoInicioNoDistribuido={resultadoInicioNoDistribuido}
                  resultadosAcumuladosSDifPatrimonial={resultadosAcumuladosSDifPatrimonial}
                />
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
