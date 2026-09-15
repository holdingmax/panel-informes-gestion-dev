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
  sectionTitle: { fontSize: 11, marginTop: 14, marginBottom: 6, fontWeight: 700 },

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

  controlRow: { flexDirection: "row", backgroundColor: "#fef08a", paddingVertical: 3, paddingHorizontal: 4, fontWeight: 700 },

  rowLabel: { flex: 1 },
  rowValue: { width: 90, textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, marginTop: 2 },
  totalLabel: { flex: 1, fontWeight: 700 },
  totalValue: { width: 90, textAlign: "right", fontWeight: 700 },
  ajusteRow: { flexDirection: "row", backgroundColor: "#eff6ff", paddingVertical: 2, paddingHorizontal: 4 },

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
  const titulo = `${report.unidadNegocioNombre.toUpperCase()} – ${MESES[report.periodoMes - 1].toUpperCase()} ${report.periodoAnio}`;
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
    <Document>
      {/* Página 2: Estado Patrimonial - Origen y Aplicación de Fondos */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{titulo}</Text>
        <Text style={styles.subheader}>ESTADO PATRIMONIAL - ORIGEN Y APLICACION DE FONDOS</Text>

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
          <Text style={styles.totalLabel3}>Total Patrimonio Neto</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.totalPatrimonioNeto)}</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.totalPatrimonioNetoAnterior)}</Text>
          <Text style={styles.totalValue3}></Text>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.totalLabel3}>Control</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.control)}</Text>
          <Text style={styles.totalValue3}>{fmtParen(balance.controlAnterior)}</Text>
          <Text style={styles.totalValue3}>{fmtParen(controlOrigenAplicacion)}</Text>
        </View>
      </Page>

      {/* Página 4: Estado de Origen y Aplicación de Fondos */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{titulo}</Text>
        <Text style={styles.subheader}>ESTADO DE ORIGEN Y APLICACION DE FONDOS</Text>

        <View style={styles.ajusteRow}>
          <Text style={styles.rowLabel}>Resultados Acumulados S/Indicadores</Text>
          <Text style={styles.rowValue}>{fmtParen(resultadoDelPeriodo)}</Text>
        </View>
        {origenAplicacion.ajustes.map((a) => (
          <View key={a.codRubro} style={styles.ajusteRow}>
            <Text style={styles.rowLabel}>Ajustes Ejercicios Anteriores ({a.nombre})</Text>
            <Text style={styles.rowValue}>{fmtParen(a.origenAplicacion)}</Text>
          </View>
        ))}
        {resultadoInicioNoDistribuido !== 0 && (
          <View style={styles.ajusteRow}>
            <Text style={styles.rowLabel}>Resultado no distribuido al inicio del ejercicio</Text>
            <Text style={styles.rowValue}>{fmtParen(resultadoInicioNoDistribuido)}</Text>
          </View>
        )}
        <View style={[styles.ajusteRow, { borderTopWidth: 1, borderTopColor: "#000", fontWeight: 700 }]}>
          <Text style={[styles.rowLabel, { fontWeight: 700 }]}>Resultados Acumulados S/Dif. Patrimonial</Text>
          <Text style={[styles.rowValue, { fontWeight: 700 }]}>
            {fmtParen(resultadosAcumuladosSDifPatrimonial)}
          </Text>
        </View>

        <View style={[styles.columns, { marginTop: 14 }]}>
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

      {/* Página 5: Necesidades Operativas de Fondos */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{titulo}</Text>
        <Text style={styles.subheader}>
          NECESIDADES OPERATIVAS DE FONDOS Y OTROS ORIGENES (APLICACIONES)
        </Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Resultados Acumulados S/Indicadores</Text>
          <Text style={styles.rowValue}>{fmtParen(resultadoDelPeriodo)}</Text>
        </View>
        {origenAplicacion.ajustes.map((a) => (
          <View key={a.codRubro} style={styles.row}>
            <Text style={styles.rowLabel}>Ajustes Ejercicios Anteriores ({a.nombre})</Text>
            <Text style={styles.rowValue}>{fmtParen(a.origenAplicacion)}</Text>
          </View>
        ))}
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

        <View style={styles.controlRow}>
          <Text style={styles.rowLabel}>Control</Text>
          <Text style={styles.rowValue}>{fmtParen(nof.control)}</Text>
        </View>
      </Page>
    </Document>
  );
}
