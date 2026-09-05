import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { InformeReport, RubroLine } from "@/lib/balance-oya-report";

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

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  header: { fontSize: 14, marginBottom: 4 },
  subheader: { fontSize: 11, marginBottom: 12, color: "#444" },
  groupHeader: { fontSize: 10, fontWeight: 700, marginTop: 10, marginBottom: 2, textTransform: "uppercase" },
  sectionTitle: { fontSize: 11, marginTop: 14, marginBottom: 6, fontWeight: 700 },

  balanceHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 2, marginBottom: 2 },
  balanceLabel: { flex: 2, fontWeight: 700 },
  balanceCol: { flex: 1, textAlign: "right", fontWeight: 700 },

  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 2 },
  rowLabel3: { flex: 2 },
  rowValue3: { flex: 1, textAlign: "right" },

  totalRow3: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, marginTop: 2 },
  totalLabel3: { flex: 2, fontWeight: 700 },
  totalValue3: { flex: 1, textAlign: "right", fontWeight: 700 },

  rowLabel: { flex: 1 },
  rowValue: { width: 90, textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, marginTop: 2 },
  totalLabel: { flex: 1, fontWeight: 700 },
  totalValue: { width: 90, textAlign: "right", fontWeight: 700 },
  totalRowNarrow: { borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, marginTop: 2 },
  totalLabelNarrow: { fontWeight: 700 },
  totalValueNarrow: { fontWeight: 700, marginTop: 2 },

  columns: { flexDirection: "row", gap: 20 },
  column: { flex: 1 },
});

function fmt(n: number) {
  return Math.round(n).toLocaleString("es-AR");
}

function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : fmt(rounded);
}

function BalanceRows({ rows }: { rows: RubroLine[] }) {
  return (
    <>
      {rows.map((r) => (
        <View key={r.codRubro} style={styles.row}>
          <Text style={styles.rowLabel3}>{r.nombre}</Text>
          <Text style={styles.rowValue3}>{fmt(r.saldoFinal)}</Text>
          <Text style={styles.rowValue3}>{fmt(r.saldoInicio)}</Text>
          <Text style={styles.rowValue3}>{fmtParen(r.origenAplicacion)}</Text>
        </View>
      ))}
    </>
  );
}

// En la columna "Aplicaciones" se invierte el signo: ahí el caso normal (el
// rubro creció) da origenAplicacion negativo, así que hay que dar vuelta el
// signo para mostrarlo en positivo — ver el comentario en balance-oya-report.ts.
function OrigenAplicacionRows({ rows, aplicacion }: { rows: RubroLine[]; aplicacion?: boolean }) {
  return (
    <>
      {rows.map((r) => (
        <View key={r.codRubro} style={styles.row}>
          <Text style={styles.rowLabel}>{r.nombre}</Text>
          <Text style={styles.rowValue}>
            {fmtParen(aplicacion ? -r.origenAplicacion : r.origenAplicacion)}
          </Text>
        </View>
      ))}
    </>
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

export function InformePDF({ report }: { report: InformeReport }) {
  const titulo = `${report.empresaNombre.toUpperCase()} – ${MESES[report.periodoMes - 1].toUpperCase()} ${report.periodoAnio}`;
  const { balance, origenAplicacion, nof, resultadoDelPeriodo, ajustesEjerciciosAnteriores } = report;

  return (
    <Document>
      {/* Página 2: Estado de Situación Patrimonial */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{titulo}</Text>
        <Text style={styles.subheader}>ESTADO DE SITUACION PATRIMONIAL</Text>

        <View style={styles.balanceHeaderRow}>
          <Text style={styles.balanceLabel}>Rubro</Text>
          <Text style={styles.balanceCol}>Saldo Final</Text>
          <Text style={styles.balanceCol}>Saldo Inicio</Text>
          <Text style={styles.balanceCol}>Origen (Aplicación)</Text>
        </View>

        <Text style={styles.groupHeader}>Activo</Text>
        <BalanceRows rows={balance.activo} />
        <View style={styles.totalRow3}>
          <Text style={styles.totalLabel3}>Total Activo</Text>
          <Text style={styles.totalValue3}>{fmt(balance.totalActivo)}</Text>
          <Text style={styles.totalValue3}></Text>
          <Text style={styles.totalValue3}></Text>
        </View>

        <Text style={styles.groupHeader}>Pasivo y Patrimonio Neto</Text>
        <BalanceRows rows={balance.pasivoYPatrimonioNeto} />
        <View style={styles.totalRow3}>
          <Text style={styles.totalLabel3}>Total Pasivo + Patrimonio Neto</Text>
          <Text style={styles.totalValue3}>{fmt(balance.totalPasivoPN)}</Text>
          <Text style={styles.totalValue3}></Text>
          <Text style={styles.totalValue3}></Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel3}>Resultado del Ejercicio</Text>
          <Text style={styles.rowValue3}>{fmt(resultadoDelPeriodo)}</Text>
          <Text style={styles.rowValue3}></Text>
          <Text style={styles.rowValue3}></Text>
        </View>
        <View style={styles.totalRow3}>
          <Text style={styles.totalLabel3}>Total Pasivo + Patrimonio Neto + Resultado</Text>
          <Text style={styles.totalValue3}>
            {fmt(balance.totalPasivoPN + resultadoDelPeriodo)}
          </Text>
          <Text style={styles.totalValue3}></Text>
          <Text style={styles.totalValue3}></Text>
        </View>
      </Page>

      {/* Página 4: Estado de Origen y Aplicación de Fondos */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{titulo}</Text>
        <Text style={styles.subheader}>ESTADO DE ORIGEN Y APLICACION DE FONDOS</Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Orígenes de Fondos</Text>
            <OrigenAplicacionRows rows={origenAplicacion.origenes} />
            {resultadoDelPeriodo > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Resultado del Ejercicio</Text>
                <Text style={styles.rowValue}>{fmt(resultadoDelPeriodo)}</Text>
              </View>
            )}
            {ajustesEjerciciosAnteriores > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Ajustes Ejercicios Anteriores</Text>
                <Text style={styles.rowValue}>{fmt(ajustesEjerciciosAnteriores)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Orígenes</Text>
              <Text style={styles.totalValue}>
                {fmt(origenAplicacion.totalOrigenes)}
              </Text>
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Aplicaciones de Fondos</Text>
            <OrigenAplicacionRows rows={origenAplicacion.aplicaciones} aplicacion />
            {resultadoDelPeriodo < 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Resultado del Ejercicio</Text>
                <Text style={styles.rowValue}>{fmt(-resultadoDelPeriodo)}</Text>
              </View>
            )}
            {ajustesEjerciciosAnteriores < 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Ajustes Ejercicios Anteriores</Text>
                <Text style={styles.rowValue}>{fmt(-ajustesEjerciciosAnteriores)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Aplicaciones</Text>
              <Text style={styles.totalValue}>
                {fmt(origenAplicacion.totalAplicaciones)}
              </Text>
            </View>
          </View>
        </View>
      </Page>

      {/* Página 5: Necesidades Operativas de Fondos */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{titulo}</Text>
        <Text style={styles.subheader}>
          NECESIDADES OPERATIVAS DE FONDOS Y OTROS ORIGENES (APLICACIONES)
        </Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Capital de Trabajo (Operativo)</Text>
            <NofRows rows={nof.operativo} />
            <View style={styles.totalRowNarrow}>
              <Text style={styles.totalLabelNarrow}>Aumento (Disminución) NCT</Text>
              <Text style={styles.totalValueNarrow}>{fmtParen(nof.totalOperativo)}</Text>
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>No Operativo</Text>
            <NofRows rows={nof.noOperativo} />
            <View style={styles.totalRowNarrow}>
              <Text style={styles.totalLabelNarrow}>Origen (Aplic.) No Operativas</Text>
              <Text style={styles.totalValueNarrow}>{fmtParen(nof.totalNoOperativo)}</Text>
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Financiamiento Propio</Text>
            <NofRows rows={nof.financiamiento} />
            <View style={styles.totalRowNarrow}>
              <Text style={styles.totalLabelNarrow}>Excedente (Necesidad) Financ.</Text>
              <Text style={styles.totalValueNarrow}>{fmtParen(nof.totalFinanciamiento)}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Resultado del Ejercicio</Text>
            <Text style={styles.rowValue}>{fmt(resultadoDelPeriodo)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Aumento (Disminución) NOF</Text>
            <Text style={styles.rowValue}>{fmtParen(nof.totalOperativo)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Resultado vs NOF</Text>
            <Text style={styles.totalValue}>{fmtParen(nof.resultadoVsNOF)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
