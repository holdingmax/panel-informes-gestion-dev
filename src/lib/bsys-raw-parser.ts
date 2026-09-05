import * as cheerio from "cheerio";

export type BsysRawRow = {
  cuenta: string;
  saldoIniDebe: number;
  saldoIniHaber: number;
  sumasDebe: number;
  sumasHaber: number;
  saldoCierreDebe: number;
  saldoCierreHaber: number;
};

function parseMonto(text: string): number {
  const cleaned = text.trim().replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

// El export del sistema contable ("3-Ratio") viene con extensión .xls pero es
// en realidad una tabla HTML — no hace falta (ni conviene) una librería de
// parseo de Excel binario para leerlo. Sirve tanto para "BSyS Mes" como para
// "BSyS Acumulado": es el mismo formato de tabla, solo cambia el rango de fechas.
export function parseBsysRawFile(html: string): BsysRawRow[] {
  const $ = cheerio.load(html);
  const rows: BsysRawRow[] = [];

  $("td.cuentas").each((_, cuentaCell) => {
    const cuenta = $(cuentaCell).text().trim();
    if (!cuenta) return;

    const tr = $(cuentaCell).closest("tr");
    const montos = tr
      .find("td.montos")
      .map((_, td) => parseMonto($(td).text()))
      .get();
    if (montos.length < 6) return;

    rows.push({
      cuenta,
      saldoIniDebe: montos[0],
      saldoIniHaber: montos[1],
      sumasDebe: montos[2],
      sumasHaber: montos[3],
      saldoCierreDebe: montos[4],
      saldoCierreHaber: montos[5],
    });
  });

  return rows;
}
