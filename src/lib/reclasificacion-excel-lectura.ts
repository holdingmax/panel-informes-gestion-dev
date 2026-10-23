import type ExcelJS from "exceljs";
import { normalizarTexto } from "@/lib/plan-de-cuentas-carga-masiva-core";
import type { FilaExcelReclasificacion } from "@/lib/reclasificacion-excel-core";

// Sin "use server": lectura de la hoja del Excel de la carga de líneas de una
// reclasificación (columnas Cuenta, Debe y Haber), separada de la acción para
// poder probarla con un archivo armado a mano.

function valorDeCelda(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object") {
    if ("result" in v && (typeof v.result === "number" || typeof v.result === "string")) return v.result;
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
  }
  return null;
}

export function leerFilasDeHoja(hoja: ExcelJS.Worksheet): { filas: FilaExcelReclasificacion[] } | { error: string } {
  const columnas = new Map<string, number>();
  hoja.getRow(1).eachCell((cell, col) => {
    const texto = valorDeCelda(cell);
    if (texto !== null) columnas.set(normalizarTexto(String(texto)), col);
  });
  const cCuenta = columnas.get("cuenta");
  const cDebe = columnas.get("debe");
  const cHaber = columnas.get("haber");
  if (!cCuenta || !cDebe || !cHaber) {
    return { error: 'La primera fila tiene que tener los encabezados "Cuenta", "Debe" y "Haber".' };
  }

  const filas: FilaExcelReclasificacion[] = [];
  for (let r = 2; r <= hoja.rowCount; r++) {
    const row = hoja.getRow(r);
    const cuenta = valorDeCelda(row.getCell(cCuenta));
    filas.push({
      fila: r,
      cuenta: cuenta === null ? "" : String(cuenta),
      debe: valorDeCelda(row.getCell(cDebe)),
      haber: valorDeCelda(row.getCell(cHaber)),
    });
  }
  return { filas };
}
