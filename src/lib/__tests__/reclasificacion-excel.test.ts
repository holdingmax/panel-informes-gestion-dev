import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { leerFilasDeHoja } from "@/lib/reclasificacion-excel-lectura";
import {
  importeDeCelda,
  validarLineasReclasificacion,
  type FilaExcelReclasificacion,
} from "@/lib/reclasificacion-excel-core";

const CUENTAS = [
  { id: "c1", cuenta: "1.01.01 - CAJA" },
  { id: "c2", cuenta: "1.01.02 - BANCO" },
  { id: "c3", cuenta: "2.01.01 - PROVEEDORES" },
];

function fila(n: number, cuenta: string, debe: FilaExcelReclasificacion["debe"], haber: FilaExcelReclasificacion["haber"]) {
  return { fila: n, cuenta, debe, haber };
}

describe("importeDeCelda", () => {
  it("entiende números y textos con formato argentino o internacional", () => {
    expect(importeDeCelda(1500.5)).toBe(1500.5);
    expect(importeDeCelda("1.234,56")).toBe(1234.56);
    expect(importeDeCelda("1234.56")).toBe(1234.56);
    expect(importeDeCelda("1,5")).toBe(1.5);
    expect(importeDeCelda("")).toBe(0);
    expect(importeDeCelda(null)).toBe(0);
    expect(importeDeCelda("abc")).toBeNaN();
  });
});

describe("validarLineasReclasificacion", () => {
  it("acepta un lote con cuentas válidas y Debe = Haber", () => {
    const r = validarLineasReclasificacion(
      [fila(2, "1.01.01 - CAJA", 1000, null), fila(3, "2.01.01 - PROVEEDORES", null, 1000)],
      CUENTAS
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lineas.map((l) => l.planDeCuentaId)).toEqual(["c1", "c3"]);
      expect(r.totalDebe).toBe(1000);
      expect(r.totalHaber).toBe(1000);
    }
  });

  it("compara el nombre sin importar mayúsculas ni espacios repetidos", () => {
    const r = validarLineasReclasificacion(
      [fila(2, "  1.01.01 -  caja ", 5, 0), fila(3, "2.01.01 - proveedores", 0, 5)],
      CUENTAS
    );
    expect(r.ok).toBe(true);
  });

  it("rechaza TODO el lote si una sola cuenta no existe, e informa cuál", () => {
    const r = validarLineasReclasificacion(
      [fila(2, "1.01.01 - CAJA", 100, null), fila(3, "1.01.99 - NO EXISTE", null, 100), fila(4, "2.01.01 - PROVEEDORES", 0, 0)],
      CUENTAS
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.cuentasIncorrectas).toEqual([{ fila: 3, cuenta: "1.01.99 - NO EXISTE" }]);
      expect(r.error).toMatch(/Se rechazó todo el archivo/);
    }
  });

  it("rechaza si el Debe y el Haber no suman lo mismo, y muestra la diferencia", () => {
    const r = validarLineasReclasificacion(
      [fila(2, "1.01.01 - CAJA", 1000, null), fila(3, "2.01.01 - PROVEEDORES", null, 900)],
      CUENTAS
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Diferencia: 100,00/);
  });

  it("rechaza importes inválidos, negativos o líneas sin importe", () => {
    expect(
      validarLineasReclasificacion([fila(2, "1.01.01 - CAJA", "x", null), fila(3, "2.01.01 - PROVEEDORES", null, 1)], CUENTAS).ok
    ).toBe(false);
    expect(
      validarLineasReclasificacion([fila(2, "1.01.01 - CAJA", -5, null), fila(3, "2.01.01 - PROVEEDORES", null, 1)], CUENTAS).ok
    ).toBe(false);
    expect(
      validarLineasReclasificacion([fila(2, "1.01.01 - CAJA", 0, 0), fila(3, "2.01.01 - PROVEEDORES", null, 1)], CUENTAS).ok
    ).toBe(false);
  });

  it("exige al menos 2 líneas y ignora las filas totalmente vacías", () => {
    const una = validarLineasReclasificacion([fila(2, "1.01.01 - CAJA", 10, null), fila(3, "", null, null)], CUENTAS);
    expect(una.ok).toBe(false);
  });

  it("una fila con importe pero sin cuenta es una cuenta incorrecta", () => {
    const r = validarLineasReclasificacion([fila(2, "", 10, null), fila(3, "2.01.01 - PROVEEDORES", null, 10)], CUENTAS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cuentasIncorrectas[0].cuenta).toBe("(vacía)");
  });
});

describe("leerFilasDeHoja + validación con un Excel real", () => {
  async function hojaDesde(filas: (string | number | null)[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Hoja1");
    filas.forEach((f) => ws.addRow(f));
    const buf = await wb.xlsx.writeBuffer();
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buf as ArrayBuffer);
    return wb2.worksheets[0];
  }

  it("lee los encabezados en cualquier orden y valida el lote", async () => {
    const hoja = await hojaDesde([
      ["haber", "Cuenta", "DEBE"],
      [null, "1.01.01 - CAJA", 1500.5],
      [1500.5, "2.01.01 - PROVEEDORES", null],
    ]);
    const lectura = leerFilasDeHoja(hoja);
    expect("filas" in lectura).toBe(true);
    if ("filas" in lectura) {
      const r = validarLineasReclasificacion(lectura.filas, CUENTAS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.lineas.map((l) => [l.planDeCuentaId, l.debe, l.haber])).toEqual([["c1", 1500.5, 0], ["c3", 0, 1500.5]]);
    }
  });

  it("informa la fila exacta de la cuenta incorrecta", async () => {
    const hoja = await hojaDesde([
      ["Cuenta", "Debe", "Haber"],
      ["1.01.01 - CAJA", 10, null],
      ["1.01.01 - CAJAA", null, 10],
    ]);
    const lectura = leerFilasDeHoja(hoja);
    if (!("filas" in lectura)) throw new Error("no leyó");
    const r = validarLineasReclasificacion(lectura.filas, CUENTAS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cuentasIncorrectas).toEqual([{ fila: 3, cuenta: "1.01.01 - CAJAA" }]);
  });

  it("sin los encabezados Cuenta, Debe y Haber, avisa", async () => {
    const hoja = await hojaDesde([["Nombre", "Importe"], ["x", 1]]);
    const lectura = leerFilasDeHoja(hoja);
    expect("error" in lectura).toBe(true);
  });
});
