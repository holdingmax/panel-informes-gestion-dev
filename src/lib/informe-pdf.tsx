import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Line,
  Rect,
  Defs,
  LinearGradient,
  Stop,
} from "@react-pdf/renderer";
import type { InformeReport, RubroLine } from "@/lib/balance-oya-report";
import { formatPeriodoAbrev } from "@/lib/balance-oya-report";
import type { ResultadoCuadro, ResultadoBloque, ResultadoColumna } from "@/lib/resultado-cuadro";

// Tamaño de página: el modelo a copiar (ver HandyWay Junio 2026.pdf) es un
// deck de diapositivas horizontales, no un documento A4 vertical — todo el
// informe, tapa incluida, se arma en A4 apaisado.
const PAGE_W = 842;
const PAGE_H = 595;

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

const COLOR_CONDICION = "#c0392b";
const COLOR_TENDENCIA_SUBE = "#16a34a";
const COLOR_TENDENCIA_BAJA = "#dc2626";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },

  // Tapa y diapositiva separadora ("RESULTADOS ECONOMICOS") — fondo
  // degradado celeste-a-azul con líneas diagonales blancas, calcado del
  // modelo. El contenido (título/subtítulo) se superpone al Svg.
  coverPage: { fontFamily: "Helvetica" },
  coverContent: { position: "absolute", left: 60, top: 300 },
  coverTitle: { fontSize: 34, fontWeight: 700, color: "#ffffff" },
  coverSubtitle: { fontSize: 13, fontWeight: 700, color: "#0b3d5c", marginTop: 10 },

  // Encabezado repetido en cada hoja de contenido: título corto (unidad +
  // período) chico arriba a la derecha, debajo el nombre de la hoja en
  // negrita con la condición (moneda/ajuste) en color, y por último el
  // recuadro de "INFORME PROVISORIO" cuando corresponde.
  tituloCorto: { fontSize: 10, color: "#555555", textAlign: "right", marginBottom: 10 },
  seccionTitulo: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  condicionTexto: { color: COLOR_CONDICION },
  provisorioBanner: { backgroundColor: "#c00000", paddingVertical: 4, paddingHorizontal: 8, marginBottom: 10 },
  provisorioTexto: { color: "#ffffff", fontSize: 9 },
  provisorioNegrita: { fontWeight: 700 },

  balanceHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1f3864",
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  balanceLabel: { flex: 2, fontWeight: 700 },
  balanceCol: { flex: 1, textAlign: "right", fontWeight: 700 },

  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 2, paddingHorizontal: 4 },
  rowLabel3: { flex: 2 },
  rowValue3: { flex: 1, textAlign: "right" },

  totalRow3: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, marginTop: 2, paddingHorizontal: 4 },
  totalLabel3: { flex: 2, fontWeight: 700 },
  totalValue3: { flex: 1, textAlign: "right", fontWeight: 700 },

  rowLabel: { flex: 1 },
  rowValue: { width: 100, textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, marginTop: 2 },
  totalLabel: { flex: 1, fontWeight: 700 },
  totalValue: { width: 100, textAlign: "right", fontWeight: 700 },
  ajusteRow: { flexDirection: "row", backgroundColor: "#dce6f1", paddingVertical: 2, paddingHorizontal: 4 },

  columns: { flexDirection: "row", gap: 30 },
  column: { flex: 1 },
  sectionTitle: { fontSize: 11, marginTop: 10, marginBottom: 6, fontWeight: 700, textDecoration: "underline" },

  // Cuadro de Resultado Nominal / Ajustado / Moneda secundaria (ER).
  erHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1f3864",
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  erLabel: { flex: 2, fontWeight: 700 },
  erCol: { flex: 1, textAlign: "right", fontWeight: 700 },
  erMesesRow: { flexDirection: "row", paddingHorizontal: 4, paddingTop: 2 },
  erMesesTexto: { flex: 1, textAlign: "right", fontSize: 8, color: "#888888" },
  erRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 2, paddingHorizontal: 4 },
  erRowLabel: { flex: 2 },
  erRowValue: { flex: 1, textAlign: "right" },
  erRowNegrita: { fontWeight: 700 },
  // 40% más grande que el texto base de la fila (9pt) para que se note más
  // a simple vista.
  erTendenciaSube: { color: COLOR_TENDENCIA_SUBE, fontSize: 13 },
  erTendenciaBaja: { color: COLOR_TENDENCIA_BAJA, fontSize: 13 },
});

function fmt(n: number) {
  return Math.round(n).toLocaleString("es-AR");
}

function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : fmt(rounded);
}

function fmtParenEnMiles(n: number, enMiles: boolean) {
  return fmtParen(enMiles ? n / 1000 : n);
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

// Fondo degradado + líneas diagonales blancas de la tapa y la diapositiva
// separadora "RESULTADOS ECONOMICOS", calcado del modelo.
function FondoDiapositiva() {
  return (
    <Svg
      width={PAGE_W}
      height={PAGE_H}
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <LinearGradient id="fondoDiapositiva" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6dd5ed" />
          <Stop offset="1" stopColor="#1a5f82" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={60} width={PAGE_W} height={PAGE_H - 60} fill="url(#fondoDiapositiva)" />
      <Line x1={680} y1={PAGE_H} x2={PAGE_W} y2={320} stroke="#ffffff" strokeWidth={1.5} />
      <Line x1={715} y1={PAGE_H} x2={PAGE_W} y2={360} stroke="#ffffff" strokeWidth={1.5} />
      <Line x1={750} y1={PAGE_H} x2={PAGE_W} y2={400} stroke="#ffffff" strokeWidth={1.5} />
    </Svg>
  );
}

// Tapa ("HANDYWAY CARGO" / "INDICADOR MES DE JUNIO 2026") y diapositiva
// separadora ("RESULTADOS ECONOMICOS", sin subtítulo) — mismo fondo,
// distinto texto.
function Diapositiva({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <Page size={[PAGE_W, PAGE_H]} style={styles.coverPage}>
      <FondoDiapositiva />
      <View style={styles.coverContent}>
        <Text style={styles.coverTitle}>{titulo}</Text>
        {subtitulo && <Text style={styles.coverSubtitle}>{subtitulo}</Text>}
      </View>
    </Page>
  );
}

function ProvisorioBanner() {
  return (
    <View style={styles.provisorioBanner}>
      <Text style={styles.provisorioTexto}>
        <Text style={styles.provisorioNegrita}>INFORME PROVISORIO</Text>
        {"  |  Cifras sujetas a revisión del informe de Auditoría."}
      </Text>
    </View>
  );
}

// Encabezado repetido en cada hoja de contenido: título corto (unidad +
// período + versión) chico arriba a la derecha, nombre de la hoja en
// negrita con la condición (moneda/ajuste) en color, y el recuadro
// "INFORME PROVISORIO" cuando el informe todavía no está auditado.
function PageHeader({
  tituloCorto,
  seccion,
  condicion,
  auditado,
}: {
  tituloCorto: string;
  seccion: string;
  condicion?: string;
  auditado: boolean;
}) {
  return (
    <>
      <Text style={styles.tituloCorto}>{tituloCorto}</Text>
      <Text style={styles.seccionTitulo}>
        {seccion}
        {condicion && <Text style={styles.condicionTexto}> – {condicion}</Text>}
      </Text>
      {!auditado && <ProvisorioBanner />}
    </>
  );
}

function BalanceRows({ rows }: { rows: RubroLine[] }) {
  return (
    <>
      {rows.map((r) => (
        <View key={r.codRubro} style={styles.row}>
          <Text style={styles.rowLabel3}>{r.nombre}</Text>
          <Text style={styles.rowValue3}>{fmtParen(r.saldoFinal)}</Text>
          <Text style={styles.rowValue3}>{fmtParen(r.saldoInicio)}</Text>
          <Text style={styles.rowValue3}>{fmtParen(r.variacion)}</Text>
        </View>
      ))}
    </>
  );
}

function OrigenAplicacionRows({ rows }: { rows: RubroLine[] }) {
  return (
    <>
      {rows.map((r) => (
        <View key={r.codRubro} style={styles.row}>
          <Text style={styles.rowLabel}>{r.nombre}</Text>
          <Text style={styles.rowValue}>{fmtParen(r.origenAplicacion)}</Text>
        </View>
      ))}
    </>
  );
}

// "Resultados Acumulados" (resultadoDelPeriodo + resultadoInicioNoDistribuido,
// siempre un Origen — ver origenAplicacionDe en balance-oya-report.ts): va
// arriba de las dos columnas, alineado a la izquierda con "Orígenes de
// Fondos" — mismo lugar que en el modelo — porque su importe entra al
// Total de Orígenes de esa columna.
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
    <View style={{ marginBottom: 10 }}>
      <View style={styles.ajusteRow}>
        <Text style={styles.rowLabel}>Resultados Acumulados S/Indicadores</Text>
        <Text style={styles.rowValue}>{fmtParen(resultadoDelPeriodo)}</Text>
      </View>
      {resultadoInicioNoDistribuido !== 0 && (
        <View style={styles.ajusteRow}>
          <Text style={styles.rowLabel}>Resultado no distribuido al inicio del ejercicio</Text>
          <Text style={styles.rowValue}>{fmtParen(resultadoInicioNoDistribuido)}</Text>
        </View>
      )}
      <View style={[styles.ajusteRow, { borderTopWidth: 1, borderTopColor: "#000" }]}>
        <Text style={[styles.rowLabel, styles.erRowNegrita]}>Resultados Acumulados S/Dif. Patrimonial</Text>
        <Text style={[styles.rowValue, styles.erRowNegrita]}>
          {fmtParen(resultadosAcumuladosSDifPatrimonial)}
        </Text>
      </View>
    </View>
  );
}

function NofRows({ rows }: { rows: RubroLine[] }) {
  return (
    <>
      {rows.map((r) => (
        <View key={r.codRubro} style={styles.row}>
          <Text style={styles.rowLabel}>{r.nombre}</Text>
          <Text style={styles.rowValue}>{fmtParen(r.origenAplicacion)}</Text>
        </View>
      ))}
    </>
  );
}

type FilaEr = {
  label: string;
  get: (c: ResultadoColumna) => number;
  pct?: boolean;
  negrita?: boolean;
};

const FILAS_ER: FilaEr[] = [
  { label: "Ventas", get: (c) => c.ventas },
  { label: "Costos directos/variables", get: (c) => c.costosDirectos },
  { label: "Margen de Contribución", get: (c) => c.margenContribucion, negrita: true },
  { label: "% MC", get: (c) => c.pctMC, pct: true },
  { label: "Gastos Fijos Operativos", get: (c) => c.gastosOperativos },
  { label: "Resultado Operativo", get: (c) => c.resultadoOperativo, negrita: true },
  { label: "% rentabilidad Negocio", get: (c) => c.pctRentabilidadNegocio, pct: true },
  { label: "Expensas", get: (c) => c.expensas },
  { label: "Otras Ganancias y Perdidas", get: (c) => c.otrasGananciasYPerdidas },
  { label: "Rentabilidad Neta", get: (c) => c.rentabilidadNeta, negrita: true },
  { label: "% rentabilidad Neta", get: (c) => c.pctRentabilidadNeta, pct: true },
];

// Mismo cuadro que CuadroResultado en er-y-cuadros/page.tsx (pantalla), una
// hoja por cada condición parametrizada en la Empresa (Nominal siempre,
// Ajustado por Inflación y/o Moneda secundaria si corresponde) — incluye la
// cantidad de meses transcurridos bajo "Promedio" y la flechita de
// tendencia (actual vs. promedio) en esa misma columna, igual que el
// modelo y que la pantalla.
function CuadroResultadoPdf({
  bloque,
  periodoLabel,
  periodoAnteriorLabel,
  periodoAnio,
  fmtValor,
}: {
  bloque: ResultadoBloque;
  periodoLabel: string;
  periodoAnteriorLabel: string;
  periodoAnio: number;
  fmtValor: (n: number) => string;
}) {
  const columnas: { label: string; datos: ResultadoColumna }[] = [
    { label: periodoLabel, datos: bloque.actual },
    { label: periodoAnteriorLabel, datos: bloque.mismoMesAnioAnterior },
    { label: `Acum ${String(periodoAnio - 1).slice(-2)}/${String(periodoAnio).slice(-2)}`, datos: bloque.acumuladoActual },
    { label: `Acum ${String(periodoAnio - 2).slice(-2)}/${String(periodoAnio - 1).slice(-2)}`, datos: bloque.acumuladoAnterior },
    { label: "Promedio", datos: bloque.promedio },
  ];
  const ultimaColumna = columnas.length - 1;

  return (
    <>
      <View style={styles.erHeaderRow}>
        <Text style={styles.erLabel}>Rubro</Text>
        {columnas.map((c) => (
          <Text key={c.label} style={styles.erCol}>
            {c.label}
          </Text>
        ))}
      </View>
      <View style={styles.erMesesRow}>
        <Text style={{ flex: 2 }} />
        {columnas.map((c, i) => (
          <Text key={c.label} style={styles.erMesesTexto}>
            {i === ultimaColumna ? bloque.mesesTranscurridos : ""}
          </Text>
        ))}
      </View>
      {FILAS_ER.map((fila) => (
        <View key={fila.label} style={styles.erRow}>
          <Text style={[styles.erRowLabel, fila.negrita ? styles.erRowNegrita : undefined]}>
            {fila.label}
          </Text>
          {columnas.map((c, i) => {
            const actual = fila.get(bloque.actual);
            const promedio = fila.get(bloque.promedio);
            const tendencia =
              i === ultimaColumna && actual !== promedio
                ? actual > promedio
                  ? styles.erTendenciaSube
                  : styles.erTendenciaBaja
                : undefined;
            return (
              <Text
                key={c.label}
                style={[styles.erRowValue, fila.negrita ? styles.erRowNegrita : undefined]}
              >
                {fila.pct ? fmtPct(fila.get(c.datos)) : fmtValor(fila.get(c.datos))}
                {/* Helvetica (fuente base del PDF) no tiene ▲/▼ en su
                codificación — se usan "^"/"v" en vez de glifos rotos. */}
                {tendencia && <Text style={tendencia}> {actual > promedio ? "^" : "v"}</Text>}
              </Text>
            );
          })}
        </View>
      ))}
    </>
  );
}

export function InformePDF({ report, cuadro }: { report: InformeReport; cuadro: ResultadoCuadro }) {
  const tituloCorto = `${report.unidadNegocioNombre.toUpperCase()} – ${MESES[report.periodoMes - 1].toUpperCase()} ${report.periodoAnio}${report.version > 1 ? ` – VERSIÓN ${report.version}` : ""}`;
  const {
    balance,
    origenAplicacion,
    nof,
    resultadoDelPeriodo,
    resultadoInicioNoDistribuido,
    resultadosAcumuladosSDifPatrimonial,
  } = report;
  const monedaPrimaria = cuadro.monedaPrimariaNombre ?? "moneda primaria";
  const condicionNominal = `Nominal ${monedaPrimaria}`;
  const condicionMiles = cuadro.presentaEnMiles ? `Miles de ${monedaPrimaria}` : undefined;

  const periodoLabel = formatPeriodoAbrev(report.periodoMes, report.periodoAnio);
  const periodoAnteriorLabel = formatPeriodoAbrev(report.periodoMes, report.periodoAnio - 1);

  return (
    <Document>
      {/* Hoja 1: tapa */}
      <Diapositiva
        titulo={report.unidadNegocioNombre.toUpperCase()}
        subtitulo={`INDICADOR MES DE ${MESES[report.periodoMes - 1].toUpperCase()} ${report.periodoAnio}`}
      />

      {/* Hoja 2: Estado de Situación Patrimonial */}
      <Page size={[PAGE_W, PAGE_H]} style={styles.page}>
        <PageHeader
          tituloCorto={tituloCorto}
          seccion="ESTADO DE SITUACION PATRIMONIAL"
          condicion={condicionNominal}
          auditado={report.auditado}
        />

        <View style={styles.balanceHeaderRow}>
          <Text style={styles.balanceLabel}>Rubro</Text>
          <Text style={styles.balanceCol}>{report.periodoLabel}</Text>
          <Text style={styles.balanceCol}>{report.periodoAnteriorLabel}</Text>
          <Text style={styles.balanceCol}>Origen (Aplicación)</Text>
        </View>

        <BalanceRows rows={balance.activo} />
        <View style={styles.totalRow3}>
          <Text style={styles.totalLabel3}>Total Activo</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.totalActivo)}</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.totalActivoAnterior)}</Text>
          <Text style={styles.totalValue3}></Text>
        </View>

        <View style={{ marginTop: 10 }} />
        <BalanceRows rows={balance.pasivo} />
        <View style={styles.totalRow3}>
          <Text style={styles.totalLabel3}>Total Pasivo</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.totalPasivo)}</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.totalPasivoAnterior)}</Text>
          <Text style={styles.totalValue3}></Text>
        </View>

        <View style={{ marginTop: 10 }} />
        <BalanceRows rows={balance.patrimonioNeto} />
        <View style={styles.totalRow3}>
          <Text style={styles.totalLabel3}></Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.totalPatrimonioNeto)}</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.totalPatrimonioNetoAnterior)}</Text>
          <Text style={styles.totalValue3}></Text>
        </View>
      </Page>

      {/* Hoja 3: Estado de Resultados — Nominal (siempre) */}
      <Page size={[PAGE_W, PAGE_H]} style={styles.page}>
        <PageHeader
          tituloCorto={tituloCorto}
          seccion="RESULTADOS ECONOMICOS COMPARADOS EN MONEDA NOMINAL"
          condicion={condicionMiles}
          auditado={report.auditado}
        />
        <CuadroResultadoPdf
          bloque={cuadro.nominal}
          periodoLabel={periodoLabel}
          periodoAnteriorLabel={periodoAnteriorLabel}
          periodoAnio={cuadro.periodoAnio}
          fmtValor={(n) => fmtParenEnMiles(n, cuadro.presentaEnMiles)}
        />
      </Page>

      {/* Hoja 4: Estado de Origen y Aplicación de Fondos */}
      <Page size={[PAGE_W, PAGE_H]} style={styles.page}>
        <PageHeader
          tituloCorto={tituloCorto}
          seccion="ESTADO DE ORIGEN Y APLICACION DE FONDOS"
          condicion={condicionNominal}
          auditado={report.auditado}
        />

        <View style={styles.columns}>
          <View style={styles.column}>
            <ResultadosAcumuladosRows
              resultadoDelPeriodo={resultadoDelPeriodo}
              resultadoInicioNoDistribuido={resultadoInicioNoDistribuido}
              resultadosAcumuladosSDifPatrimonial={resultadosAcumuladosSDifPatrimonial}
            />
          </View>
          <View style={styles.column} />
        </View>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Orígenes de Fondos</Text>
            <OrigenAplicacionRows rows={origenAplicacion.origenes} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total de Orígenes</Text>
              <Text style={styles.totalValue}>{fmtParen(origenAplicacion.totalOrigenes)}</Text>
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Aplicaciones de Fondos</Text>
            <OrigenAplicacionRows rows={origenAplicacion.aplicaciones} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Aplicaciones</Text>
              <Text style={styles.totalValue}>{fmtParen(origenAplicacion.totalAplicaciones)}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* Hoja 5: Necesidades Operativas de Fondos */}
      <Page size={[PAGE_W, PAGE_H]} style={styles.page}>
        <PageHeader
          tituloCorto={tituloCorto}
          seccion="NECESIDADES OPERATIVAS DE FONDOS Y OTROS ORIGENES (APLICACIONES)"
          auditado={report.auditado}
        />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Resultados Acumulados S/Indicadores</Text>
          <Text style={styles.rowValue}>{fmtParen(resultadoDelPeriodo)}</Text>
        </View>
        {resultadoInicioNoDistribuido !== 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Resultado no distribuido al inicio del ejercicio</Text>
            <Text style={styles.rowValue}>{fmtParen(resultadoInicioNoDistribuido)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Aumento (Disminución) NOF</Text>
          <Text style={styles.rowValue}>{fmtParen(nof.totalOperativo)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Resultado vs NOF</Text>
          <Text style={styles.totalValue}>{fmtParen(nof.resultadoVsNOF)}</Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <NofRows rows={nof.noOperativo} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Origen (Aplicación) No Operativas</Text>
            <Text style={styles.totalValue}>{fmtParen(nof.totalNoOperativo)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <NofRows rows={nof.financiamiento} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Excedente (Necesidad) Financiamiento Propio</Text>
            <Text style={styles.totalValue}>{fmtParen(nof.totalFinanciamiento)}</Text>
          </View>
        </View>
      </Page>

      {/* Hoja 6: diapositiva separadora "RESULTADOS ECONOMICOS" */}
      <Diapositiva titulo="RESULTADOS ECONOMICOS" />

      {/* Hoja 7: Estado de Resultados — Ajustado por Inflación (solo si la Empresa lo tiene parametrizado) */}
      {cuadro.tieneAjustePorInflacion && cuadro.ajustadoPorInflacion && (
        <Page size={[PAGE_W, PAGE_H]} style={styles.page}>
          <PageHeader
            tituloCorto={tituloCorto}
            seccion="RESULTADOS ECONOMICOS COMPARADOS EN MONEDA AJUSTADA"
            condicion={condicionMiles}
            auditado={report.auditado}
          />
          <CuadroResultadoPdf
            bloque={cuadro.ajustadoPorInflacion}
            periodoLabel={periodoLabel}
            periodoAnteriorLabel={periodoAnteriorLabel}
            periodoAnio={cuadro.periodoAnio}
            fmtValor={(n) => fmtParenEnMiles(n, cuadro.presentaEnMiles)}
          />
        </Page>
      )}

      {/* Hoja 8: Estado de Resultados — Moneda secundaria (solo si la Empresa la tiene parametrizada) */}
      {cuadro.tieneMonedaSecundaria && cuadro.usd && (
        <Page size={[PAGE_W, PAGE_H]} style={styles.page}>
          <PageHeader
            tituloCorto={tituloCorto}
            seccion={`RESULTADOS ECONOMICOS COMPARADOS EN ${(cuadro.monedaSecundariaNombre ?? "MONEDA SECUNDARIA").toUpperCase()}`}
            auditado={report.auditado}
          />
          <CuadroResultadoPdf
            bloque={cuadro.usd}
            periodoLabel={periodoLabel}
            periodoAnteriorLabel={periodoAnteriorLabel}
            periodoAnio={cuadro.periodoAnio}
            fmtValor={fmtParen}
          />
        </Page>
      )}
    </Document>
  );
}
