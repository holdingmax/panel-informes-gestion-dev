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
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function RubroTable({ rows, label }: { rows: RubroLine[]; label: string }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          <th className="py-1">{label}</th>
          <th className="py-1 text-right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.codRubro} className="border-t">
            <td className="py-1">{r.nombre}</td>
            <td className="py-1 text-right">{fmt(r.saldoFinal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrigenAplicacionTable({ rows }: { rows: RubroLine[] }) {
  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.codRubro} className="border-t">
            <td className="py-1">{r.nombre}</td>
            <td className="py-1 text-right">{fmt(r.origenAplicacion)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function InformeDetallePage({
  params,
}: {
  params: Promise<{ codEmp: string; informeId: string }>;
}) {
  const { informeId } = await params;
  const report = await computeInformeReport(informeId);

  return (
    <div className="flex flex-col gap-8">
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

      <section>
        <h3 className="text-base font-medium">Estado de Situación Patrimonial</h3>
        <div className="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <RubroTable rows={report.balance.activo} label="Activo" />
            <p className="mt-1 flex justify-between border-t py-1 text-sm font-medium">
              <span>Total Activo</span>
              <span>{fmt(report.balance.totalActivo)}</span>
            </p>
          </div>
          <div>
            <RubroTable rows={report.balance.pasivo} label="Pasivo / Patrimonio Neto" />
            <p className="mt-1 flex justify-between border-t py-1 text-sm font-medium">
              <span>Total Pasivo + PN</span>
              <span>{fmt(report.balance.totalPasivoPN)}</span>
            </p>
          </div>
        </div>
        <p className="mt-2 text-sm">
          Resultado del período: <strong>{fmt(report.resultadoDelPeriodo)}</strong>
        </p>
      </section>

      <section>
        <h3 className="text-base font-medium">Estado de Origen y Aplicación de Fondos</h3>
        <div className="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium">Orígenes</h4>
            <OrigenAplicacionTable rows={report.origenAplicacion.origenes} />
            <p className="mt-1 flex justify-between border-t py-1 text-sm font-medium">
              <span>Total Orígenes</span>
              <span>{fmt(report.origenAplicacion.totalOrigenes)}</span>
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium">Aplicaciones</h4>
            <OrigenAplicacionTable rows={report.origenAplicacion.aplicaciones} />
            <p className="mt-1 flex justify-between border-t py-1 text-sm font-medium">
              <span>Total Aplicaciones</span>
              <span>{fmt(report.origenAplicacion.totalAplicaciones)}</span>
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-base font-medium">Necesidades Operativas de Fondos</h3>
        <div className="mt-2 flex flex-col gap-1 text-sm">
          <p className="flex justify-between">
            <span>Aumento Necesidades de Capital de Trabajo (NOF)</span>
            <span>{fmt(report.nof.totalOperativo)}</span>
          </p>
          <p className="flex justify-between">
            <span>Origen (Aplicación) no operativas</span>
            <span>{fmt(report.nof.totalNoOperativo)}</span>
          </p>
          <p className="flex justify-between">
            <span>Excedente Financiamiento Propio</span>
            <span>{fmt(report.nof.totalFinanciamiento)}</span>
          </p>
          <p className="flex justify-between border-t pt-1 font-medium">
            <span>Resultado vs NOF</span>
            <span>{fmt(report.nof.resultadoVsNOF)}</span>
          </p>
        </div>
      </section>
    </div>
  );
}
