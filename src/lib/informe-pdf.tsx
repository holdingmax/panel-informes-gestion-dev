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
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { fontSize: 14, marginBottom: 4 },
  subheader: { fontSize: 11, marginBottom: 12, color: "#444" },
  sectionTitle: { fontSize: 12, marginTop: 16, marginBottom: 6, fontWeight: 700 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 3 },
  rowLabel: { flex: 1 },
  rowValue: { width: 100, textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, marginTop: 2 },
  totalLabel: { flex: 1, fontWeight: 700 },
  totalValue: { width: 100, textAlign: "right", fontWeight: 700 },
  columns: { flexDirection: "row", gap: 24 },
  column: { flex: 1 },
});

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function Rows({ rows, showOrigenAplicacion }: { rows: RubroLine[]; showOrigenAplicacion?: boolean }) {
  return (
    <>
      {rows.map((r) => (
        <View key={r.codRubro} style={styles.row}>
          <Text style={styles.rowLabel}>{r.nombre}</Text>
          <Text style={styles.rowValue}>
            {fmt(showOrigenAplicacion ? r.origenAplicacion : r.saldoFinal)}
          </Text>
        </View>
      ))}
    </>
  );
}

export function InformePDF({ report }: { report: InformeReport }) {
  const titulo = `${report.empresaNombre.toUpperCase()} – ${MESES[report.periodoMes - 1].toUpperCase()} ${report.periodoAnio}`;

  return (
    <Document>
      {/* Página 2: Estado de Situación Patrimonial */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{titulo}</Text>
        <Text style={styles.subheader}>ESTADO DE SITUACION PATRIMONIAL</Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Activo</Text>
            <Rows rows={report.balance.activo} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Activo</Text>
              <Text style={styles.totalValue}>{fmt(report.balance.totalActivo)}</Text>
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Pasivo / Patrimonio Neto</Text>
            <Rows rows={report.balance.pasivo} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Pasivo + PN</Text>
              <Text style={styles.totalValue}>{fmt(report.balance.totalPasivoPN)}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Resultado del período</Text>
            <Text style={styles.rowValue}>{fmt(report.resultadoDelPeriodo)}</Text>
          </View>
        </View>
      </Page>

      {/* Página 4: Estado de Origen y Aplicación de Fondos */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{titulo}</Text>
        <Text style={styles.subheader}>ESTADO DE ORIGEN Y APLICACION DE FONDOS</Text>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Orígenes de Fondos</Text>
            <Rows rows={report.origenAplicacion.origenes} showOrigenAplicacion />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Orígenes</Text>
              <Text style={styles.totalValue}>
                {fmt(report.origenAplicacion.totalOrigenes)}
              </Text>
            </View>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Aplicaciones de Fondos</Text>
            <Rows rows={report.origenAplicacion.aplicaciones} showOrigenAplicacion />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Aplicaciones</Text>
              <Text style={styles.totalValue}>
                {fmt(report.origenAplicacion.totalAplicaciones)}
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

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Resultado del período</Text>
          <Text style={styles.rowValue}>{fmt(report.resultadoDelPeriodo)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Aumento Necesidades de Capital de Trabajo (NOF)</Text>
          <Text style={styles.rowValue}>{fmt(report.nof.totalOperativo)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Resultado vs NOF</Text>
          <Text style={styles.totalValue}>{fmt(report.nof.resultadoVsNOF)}</Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Origen (Aplicación) no operativas</Text>
            <Text style={styles.rowValue}>{fmt(report.nof.totalNoOperativo)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Excedente Financiamiento Propio</Text>
            <Text style={styles.rowValue}>{fmt(report.nof.totalFinanciamiento)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
