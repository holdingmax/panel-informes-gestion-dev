"use server";

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { leerFilasDeHoja } from "@/lib/reclasificacion-excel-lectura";
import { checkEditableReclasificacion } from "@/lib/reclasificacion-actions";
import {
  validarLineasReclasificacion,
  type LineaCargada,
} from "@/lib/reclasificacion-excel-core";

const MAX_BYTES = 5 * 1024 * 1024;

export type RespuestaLineasExcel =
  | { tipo: "ok"; lineas: LineaCargada[]; totalDebe: number; totalHaber: number }
  | { tipo: "error"; mensaje: string; cuentasIncorrectas: { fila: number; cuenta: string }[] };

// Lee un Excel con las columnas Cuenta, Debe y Haber (en la primera fila, en
// cualquier orden) y valida el lote completo contra el Plan de Cuentas de la
// empresa. No guarda nada: devuelve las líneas para que el operador las cargue
// en el formulario y siga completando la reclasificación a mano. Devuelve el
// resultado (no lanza) para que el mensaje llegue a la pantalla.
export async function leerLineasDeExcel(
  informeId: string,
  empresaId: number,
  formData: FormData
): Promise<RespuestaLineasExcel> {
  const error = (mensaje: string): RespuestaLineasExcel => ({ tipo: "error", mensaje, cuentasIncorrectas: [] });

  // Mismo permiso y mismo estado que para cargar una reclasificación a mano.
  const check = await checkEditableReclasificacion(informeId);
  if (check.blocked) return error(check.reason);

  const informe = await prisma.informe.findUniqueOrThrow({
    where: { id: informeId },
    select: { unidadNegocioId: true },
  });
  const vinculo = await prisma.empresaUnidad.findUnique({
    where: { empresaId_unidadNegocioId: { empresaId, unidadNegocioId: informe.unidadNegocioId } },
    select: { empresaId: true },
  });
  if (!vinculo) return error("Esa empresa no pertenece a la unidad de negocio de este informe.");

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return error("Seleccioná un archivo Excel.");
  if (archivo.size > MAX_BYTES) return error("El archivo supera los 5 MB.");

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await archivo.arrayBuffer());
  } catch {
    return error("No se pudo leer el archivo. Tiene que ser un Excel (.xlsx).");
  }
  const hoja = wb.worksheets[0];
  if (!hoja) return error("El archivo no tiene hojas.");

  const lectura = leerFilasDeHoja(hoja);
  if ("error" in lectura) return error(lectura.error);
  const filas = lectura.filas;

  const cuentas = await prisma.planDeCuentas.findMany({
    where: { empresaId },
    select: { id: true, cuenta: true },
  });
  const resultado = validarLineasReclasificacion(filas, cuentas);
  if (!resultado.ok) {
    return { tipo: "error", mensaje: resultado.error, cuentasIncorrectas: resultado.cuentasIncorrectas };
  }
  return { tipo: "ok", lineas: resultado.lineas, totalDebe: resultado.totalDebe, totalHaber: resultado.totalHaber };
}
