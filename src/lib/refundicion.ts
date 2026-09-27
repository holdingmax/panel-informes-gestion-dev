import type { BsysRawRow } from "@/lib/bsys-raw-parser";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

const EPSILON = 0.02;

export type RefundicionResult = { success: true; rows: BsysRawRow[] } | { error: string };

function netoInicio(r: BsysRawRow): number {
  return r.saldoIniDebe - r.saldoIniHaber;
}

function netoCierre(r: BsysRawRow): number {
  return r.saldoCierreDebe - r.saldoCierreHaber;
}

function netoADebeHaber(neto: number): { debe: number; haber: number } {
  return neto >= 0 ? { debe: neto, haber: 0 } : { debe: 0, haber: -neto };
}

// El sistema contable de origen a veces no postea el asiento de cierre de
// ejercicio antes de exportar el Acumulado: las cuentas de Resultado
// (Ingresos "4.x", Egresos "5.x") arrastran un saldo de inicio que en
// realidad ya debería estar en cero. Esta función arma esa refundición a
// mano: lleva a cero el saldo de inicio de esas cuentas y contra-imputa la
// misma suma a la cuenta de RNA (Resultados No Asignados) que indique el
// operador, reconstruyendo el saldo final de cada cuenta afectada a partir
// de su nuevo saldo de inicio más el movimiento del período (que no se
// toca) — y verifica que el total del batch no haya cambiado.
export function aplicarRefundicion(rows: BsysRawRow[], cuentaRNA: string): RefundicionResult {
  const cuentaRNANormalizada = normalizeCuenta(cuentaRNA);
  if (!cuentaRNANormalizada) {
    return { error: "Falta indicar la cuenta de RNA." };
  }

  const netoTotalIniAntes = rows.reduce((acc, r) => acc + netoInicio(r), 0);
  const netoTotalFinAntes = rows.reduce((acc, r) => acc + netoCierre(r), 0);

  const resultado = rows.map((r) => ({ ...r }));

  let totalNetOriginal = 0;
  for (const r of resultado) {
    const primerDigito = r.cuenta.trim().charAt(0);
    if (primerDigito !== "4" && primerDigito !== "5") continue;

    totalNetOriginal += netoInicio(r);
    r.saldoIniDebe = 0;
    r.saldoIniHaber = 0;

    // Saldo final reconstruido: el movimiento del período (sumasDebe -
    // sumasHaber) tal como viene en el archivo, sumado al nuevo saldo de
    // inicio (cero).
    const { debe, haber } = netoADebeHaber(r.sumasDebe - r.sumasHaber);
    r.saldoCierreDebe = debe;
    r.saldoCierreHaber = haber;
  }

  if (totalNetOriginal === 0) {
    return { error: "No se encontraron cuentas de Ingresos (4.x) o Egresos (5.x) con saldo de inicio distinto de cero — no hay nada para refundir." };
  }

  let filaRNA = resultado.find((r) => normalizeCuenta(r.cuenta) === cuentaRNANormalizada);
  if (!filaRNA) {
    filaRNA = {
      cuenta: cuentaRNA,
      saldoIniDebe: 0,
      saldoIniHaber: 0,
      sumasDebe: 0,
      sumasHaber: 0,
      saldoCierreDebe: 0,
      saldoCierreHaber: 0,
    };
    resultado.push(filaRNA);
  }

  const netoRNANuevo = netoInicio(filaRNA) + totalNetOriginal;
  const inicioRNA = netoADebeHaber(netoRNANuevo);
  filaRNA.saldoIniDebe = inicioRNA.debe;
  filaRNA.saldoIniHaber = inicioRNA.haber;

  const cierreRNA = netoADebeHaber(netoRNANuevo + (filaRNA.sumasDebe - filaRNA.sumasHaber));
  filaRNA.saldoCierreDebe = cierreRNA.debe;
  filaRNA.saldoCierreHaber = cierreRNA.haber;

  // La refundición no debe cambiar el total del batch — solo mueve saldo
  // entre cuentas. Si esto no cierra, es un bug en esta función, no un
  // problema del archivo de origen.
  const netoTotalIniDespues = resultado.reduce((acc, r) => acc + netoInicio(r), 0);
  const netoTotalFinDespues = resultado.reduce((acc, r) => acc + netoCierre(r), 0);
  if (Math.abs(netoTotalIniDespues - netoTotalIniAntes) > EPSILON) {
    return {
      error: `La refundición no mantuvo la igualdad contable en los saldos de inicio (antes: ${netoTotalIniAntes.toFixed(2)}, después: ${netoTotalIniDespues.toFixed(2)}). No se realizó la carga.`,
    };
  }
  if (Math.abs(netoTotalFinDespues - netoTotalFinAntes) > EPSILON) {
    return {
      error: `La refundición no mantuvo la igualdad contable en los saldos finales (antes: ${netoTotalFinAntes.toFixed(2)}, después: ${netoTotalFinDespues.toFixed(2)}). No se realizó la carga.`,
    };
  }

  return { success: true, rows: resultado };
}
