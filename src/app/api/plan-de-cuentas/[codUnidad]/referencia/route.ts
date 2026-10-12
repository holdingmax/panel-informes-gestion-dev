import { requireAccesoUnidad } from "@/lib/authz";
import { generarExcelReferencia } from "@/lib/plan-de-cuentas-excel";

// Excel de referencia para armar el archivo de la carga masiva del Plan de
// Cuentas (ver generarExcelReferencia). Mismo permiso que la pantalla de Plan
// de Cuentas de la unidad.
export async function GET(_request: Request, { params }: { params: Promise<{ codUnidad: string }> }) {
  const codUnidad = Number((await params).codUnidad);
  if (!Number.isInteger(codUnidad)) return new Response(null, { status: 400 });

  try {
    await requireAccesoUnidad(codUnidad, "configuracion");
  } catch {
    return new Response(null, { status: 403 });
  }

  const contenido = await generarExcelReferencia(codUnidad);
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plan-de-cuentas-referencia-${hoy}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
