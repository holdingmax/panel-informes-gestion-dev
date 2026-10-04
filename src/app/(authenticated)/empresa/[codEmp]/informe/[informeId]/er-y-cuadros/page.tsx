import { computeResultadoCuadro, type ResultadoBloque, type ResultadoColumna } from "@/lib/resultado-cuadro";
import { formatPeriodoAbrev } from "@/lib/balance-oya-report";
import { getCuentasSinSubrubro, type ResultadoNominal } from "@/lib/resultado-nominal";
import { OjoCampoResultado } from "./OjoCampoResultado";
import { AvisoCuentasSinClasificar } from "../AvisoCuentasSinClasificar";

export const dynamic = "force-dynamic";

// "Presenta en miles" es configurable por Empresa (Configuración →
// Empresas): solo afecta a la moneda primaria (Nominal y Ajustado por
// Inflación) — la moneda secundaria siempre se muestra en unidades (fmtUsd).
function fmtParen(n: number, enMiles: boolean) {
  const rounded = Math.round(enMiles ? n / 1000 : n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

function fmtUsd(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

type Fila = {
  label: string;
  get: (c: ResultadoColumna) => number;
  pct?: boolean;
  // Solo en las 5 filas de campo del ER (no en las derivadas, como Margen de
  // Contribución) — habilita el 👁 de detalle por cuenta, únicamente en el
  // cuadro Nominal y en la columna del período actual.
  campo?: keyof ResultadoNominal;
};

const FILAS: Fila[] = [
  { label: "Ventas", get: (c) => c.ventas, campo: "ventas" },
  { label: "Costos directos/variables", get: (c) => c.costosDirectos, campo: "costosDirectos" },
  { label: "Margen de Contribución", get: (c) => c.margenContribucion },
  { label: "% MC", get: (c) => c.pctMC, pct: true },
  { label: "Gastos Fijos Operativos", get: (c) => c.gastosOperativos, campo: "gastosOperativos" },
  { label: "Resultado Operativo", get: (c) => c.resultadoOperativo },
  { label: "% rentabilidad Negocio", get: (c) => c.pctRentabilidadNegocio, pct: true },
  { label: "Expensas", get: (c) => c.expensas, campo: "expensas" },
  { label: "Otras Ganancias y Perdidas", get: (c) => c.otrasGananciasYPerdidas, campo: "otrasGananciasYPerdidas" },
  { label: "Rentabilidad Neta", get: (c) => c.rentabilidadNeta },
  { label: "% rentabilidad Neta", get: (c) => c.pctRentabilidadNeta, pct: true },
];

const NEGRITA = new Set(["Margen de Contribución", "Resultado Operativo", "Rentabilidad Neta"]);

// Comparación "=SIGNO(actual - promedio)": en nuestra convención de signo
// (positivo = favorable, tanto para Ventas como para Costos/Gastos) un valor
// mayor que el promedio siempre es la mejora, sea cual sea la fila — no hace
// falta distinguir "fila de ingreso" vs "fila de gasto" a mano.
function Tendencia({ actual, promedio }: { actual: number; promedio: number }) {
  if (actual === promedio) return <span className="text-zinc-400">—</span>;
  const sube = actual > promedio;
  return (
    <span className={sube ? "text-green-600" : "text-red-600"}>{sube ? "▲" : "▼"}</span>
  );
}

function CuadroResultado({
  titulo,
  bloque,
  periodoLabel,
  periodoAnteriorLabel,
  periodoAnio,
  fmt,
  codEmp,
  informeId,
  mostrarOjo,
  soloLectura,
}: {
  titulo: string;
  bloque: ResultadoBloque;
  periodoLabel: string;
  periodoAnteriorLabel: string;
  periodoAnio: number;
  fmt: (n: number) => string;
  codEmp: string;
  informeId: string;
  mostrarOjo?: boolean;
  soloLectura: boolean;
}) {
  const columnas: { label: string; datos: ResultadoColumna }[] = [
    { label: periodoLabel, datos: bloque.actual },
    { label: periodoAnteriorLabel, datos: bloque.mismoMesAnioAnterior },
    { label: `Acum ${String(periodoAnio - 1).slice(-2)}/${String(periodoAnio).slice(-2)}`, datos: bloque.acumuladoActual },
    { label: `Acum ${String(periodoAnio - 2).slice(-2)}/${String(periodoAnio - 1).slice(-2)}`, datos: bloque.acumuladoAnterior },
    { label: "Promedio", datos: bloque.promedio },
  ];

  return (
    <section className="rounded-lg bg-white shadow">
      <h3 className="p-4 pb-0 text-base font-medium">{titulo}</h3>
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="bg-[#1f3864] text-white">
            <th className="py-2 pl-4 font-semibold">Rubro</th>
            {columnas.map((c) => (
              <th key={c.label} className="py-2 text-right font-semibold">
                {c.label}
              </th>
            ))}
            <th className="py-2 pr-4 text-center font-semibold">Tend.</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-zinc-200 text-xs text-zinc-500">
            <td className="py-1 pl-4" colSpan={5} />
            <td className="py-1 pr-4 text-right">{bloque.mesesTranscurridos}</td>
            <td />
          </tr>
          {FILAS.map((fila) => (
            <tr
              key={fila.label}
              className={`border-t border-zinc-200 ${NEGRITA.has(fila.label) ? "font-semibold" : ""}`}
            >
              <td className="py-1 pl-4">
                <span className="inline-flex items-center gap-2">
                  {fila.label}
                  {mostrarOjo && fila.campo && (
                    <OjoCampoResultado
                      codEmp={codEmp}
                      informeId={informeId}
                      campo={fila.campo}
                      soloLectura={soloLectura}
                    />
                  )}
                </span>
              </td>
              {columnas.map((c) => (
                <td key={c.label} className="py-1 pr-4 text-right">
                  {fila.pct ? fmtPct(fila.get(c.datos)) : fmt(fila.get(c.datos))}
                </td>
              ))}
              <td className="py-1 pr-4 text-center">
                <Tendencia actual={fila.get(bloque.actual)} promedio={fila.get(bloque.promedio)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function ErYCuadrosPage({
  params,
  searchParams,
}: {
  params: Promise<{ codEmp: string; informeId: string }>;
  searchParams: Promise<{ soloLectura?: string }>;
}) {
  const { codEmp, informeId } = await params;
  const { soloLectura: soloLecturaParam } = await searchParams;
  const soloLectura = soloLecturaParam === "1";
  const [report, sinSubrubro] = await Promise.all([
    computeResultadoCuadro(informeId),
    getCuentasSinSubrubro(informeId),
  ]);
  const periodoLabel = formatPeriodoAbrev(report.periodoMes, report.periodoAnio);
  const periodoAnteriorLabel = formatPeriodoAbrev(report.periodoMes, report.periodoAnio - 1);

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-lg font-medium">
        ER y Cuadros — {periodoLabel}
        {report.version > 1 && ` — versión ${report.version}`} — {report.unidadNegocioNombre}
      </h2>

      {sinSubrubro.cuentas.length > 0 && (
        <AvisoCuentasSinClasificar
          mensaje={`HAY CUENTAS SIN VALORES EN SUBRUBRO (${sinSubrubro.cuentas.length})`}
          url={`/empresa/${codEmp}/informe/${informeId}/er-y-cuadros/sin-subrubro${soloLectura ? "?soloLectura=1" : ""}`}
          windowName={`sin-subrubro-${informeId}`}
        />
      )}

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

      <CuadroResultado
        titulo={`Nominal en ${report.monedaPrimariaNombre ?? "moneda primaria"}${report.presentaEnMiles ? " (en miles)" : ""}`}
        bloque={report.nominal}
        periodoLabel={periodoLabel}
        periodoAnteriorLabel={periodoAnteriorLabel}
        periodoAnio={report.periodoAnio}
        fmt={(n) => fmtParen(n, report.presentaEnMiles)}
        codEmp={codEmp}
        informeId={informeId}
        soloLectura={soloLectura}
        mostrarOjo
      />

      {report.tieneAjustePorInflacion &&
        (report.ajustadoPorInflacion ? (
          <CuadroResultado
            titulo={`Ajustado por Inflación (${report.presentaEnMiles ? "en miles de " : ""}${report.monedaPrimariaNombre ?? "moneda primaria"} de hoy)`}
            bloque={report.ajustadoPorInflacion}
            periodoLabel={periodoLabel}
            periodoAnteriorLabel={periodoAnteriorLabel}
            periodoAnio={report.periodoAnio}
            fmt={(n) => fmtParen(n, report.presentaEnMiles)}
            codEmp={codEmp}
            informeId={informeId}
            soloLectura={soloLectura}
          />
        ) : (
          <p className="text-sm text-zinc-600">
            No se pudo armar el cuadro Ajustado por Inflación (falta información en Series e
            Índices) — ver advertencias arriba.
          </p>
        ))}

      {report.tieneMonedaSecundaria &&
        (report.usd ? (
          <CuadroResultado
            titulo={report.monedaSecundariaNombre ?? "Moneda secundaria"}
            bloque={report.usd}
            periodoLabel={periodoLabel}
            periodoAnteriorLabel={periodoAnteriorLabel}
            periodoAnio={report.periodoAnio}
            fmt={fmtUsd}
            codEmp={codEmp}
            informeId={informeId}
            soloLectura={soloLectura}
          />
        ) : (
          <p className="text-sm text-zinc-600">
            No se pudo armar el cuadro en {report.monedaSecundariaNombre ?? "moneda secundaria"}{" "}
            (falta información en Series e Índices) — ver advertencias arriba.
          </p>
        ))}
    </div>
  );
}
