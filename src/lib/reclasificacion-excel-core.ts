import { normalizeCuenta } from "@/lib/cuenta-normalize";

// Núcleo puro (sin Prisma ni Excel) de la carga de líneas de una
// reclasificación desde un archivo: solo cuenta, debe y haber. La acción que
// lee el archivo y busca el Plan de Cuentas está en reclasificacion-excel.ts.

export type FilaExcelReclasificacion = {
  // Número de fila en la hoja de Excel, para avisar dónde está cada problema.
  fila: number;
  cuenta: string;
  debe: string | number | null;
  haber: string | number | null;
};

export type LineaCargada = { planDeCuentaId: string; cuenta: string; debe: number; haber: number };

export type ResultadoLineasExcel =
  | { ok: true; lineas: LineaCargada[]; totalDebe: number; totalHaber: number }
  | {
      ok: false;
      error: string;
      // Cuentas del archivo que no están en el Plan de Cuentas de la empresa:
      // el lote se rechaza entero y se informan para corregir el archivo.
      cuentasIncorrectas: { fila: number; cuenta: string }[];
    };

const TOLERANCIA = 0.01;

// Importe de una celda: número, o texto como "1.234,56" / "1234.56" / "1,5".
// Vacío = 0. NaN si no es un importe.
export function importeDeCelda(valor: string | number | null): number {
  if (valor === null || valor === "") return 0;
  if (typeof valor === "number") return valor;
  let t = valor.trim().replace(/\s/g, "");
  if (t === "") return 0;
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

// Controla el lote completo y lo acepta o lo rechaza entero: cada cuenta tiene
// que existir en el Plan de Cuentas de la empresa (mismo nombre, sin importar
// mayúsculas ni espacios repetidos), cada línea tiene un importe en Debe o en
// Haber, y la suma del Debe tiene que ser igual a la del Haber.
export function validarLineasReclasificacion(
  filas: FilaExcelReclasificacion[],
  cuentasDeLaEmpresa: { id: string; cuenta: string }[]
): ResultadoLineasExcel {
  const porNombre = new Map(cuentasDeLaEmpresa.map((c) => [normalizeCuenta(c.cuenta), c]));
  const conDatos = filas.filter(
    (f) => f.cuenta.trim() !== "" || (f.debe !== null && f.debe !== "") || (f.haber !== null && f.haber !== "")
  );

  const cuentasIncorrectas: { fila: number; cuenta: string }[] = [];
  const otrosErrores: string[] = [];
  const lineas: LineaCargada[] = [];

  for (const f of conDatos) {
    const cuenta = f.cuenta.trim();
    const encontrada = cuenta ? porNombre.get(normalizeCuenta(cuenta)) : undefined;
    if (!encontrada) {
      cuentasIncorrectas.push({ fila: f.fila, cuenta: cuenta || "(vacía)" });
      continue;
    }
    const debe = importeDeCelda(f.debe);
    const haber = importeDeCelda(f.haber);
    if (!Number.isFinite(debe) || !Number.isFinite(haber)) {
      otrosErrores.push(`Fila ${f.fila}: el Debe o el Haber no es un importe válido.`);
    } else if (debe < 0 || haber < 0) {
      otrosErrores.push(`Fila ${f.fila}: el Debe y el Haber no pueden ser negativos.`);
    } else if (debe === 0 && haber === 0) {
      otrosErrores.push(`Fila ${f.fila}: la cuenta necesita un importe en Debe o en Haber.`);
    } else {
      lineas.push({ planDeCuentaId: encontrada.id, cuenta: encontrada.cuenta, debe, haber });
    }
  }

  if (cuentasIncorrectas.length > 0) {
    return {
      ok: false,
      cuentasIncorrectas,
      error: `Se rechazó todo el archivo: ${cuentasIncorrectas.length} cuenta(s) no están en el Plan de Cuentas de esta empresa (tienen que tener exactamente el mismo nombre). Corregí el archivo y volvé a intentar.`,
    };
  }
  if (otrosErrores.length > 0) {
    return { ok: false, cuentasIncorrectas: [], error: `Se rechazó todo el archivo. ${otrosErrores.join(" ")}` };
  }
  if (lineas.length < 2) {
    return {
      ok: false,
      cuentasIncorrectas: [],
      error: "Una reclasificación necesita al menos 2 líneas (origen y destino).",
    };
  }

  const totalDebe = lineas.reduce((a, l) => a + l.debe, 0);
  const totalHaber = lineas.reduce((a, l) => a + l.haber, 0);
  if (Math.abs(totalDebe - totalHaber) > TOLERANCIA) {
    const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      ok: false,
      cuentasIncorrectas: [],
      error: `Se rechazó todo el archivo: la suma del Debe (${fmt(totalDebe)}) no es igual a la del Haber (${fmt(totalHaber)}). Diferencia: ${fmt(Math.abs(totalDebe - totalHaber))}.`,
    };
  }

  return { ok: true, lineas, totalDebe, totalHaber };
}
