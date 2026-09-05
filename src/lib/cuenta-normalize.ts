// El nombre de una cuenta puede venir con distinto casing o espaciado según la
// fuente (el Plan de Cuentas importado desde HOJA LLAVE vs. el export mensual
// del sistema contable) aunque sea la misma cuenta. Se compara siempre por
// esta forma normalizada, nunca por igualdad exacta de string.
export function normalizeCuenta(cuenta: string): string {
  return cuenta.trim().replace(/\s+/g, " ").toUpperCase();
}
