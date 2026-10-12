import { requireAccesoUnidad } from "@/lib/authz";
import { generarTablasActuales } from "@/lib/plan-de-cuentas-excel";

// Descarga "tablas-actuales" (ver generarTablasActuales): el mismo archivo desde
// cualquier unidad, con los valores de todas las tablas en este momento. La
// unidad de la ruta solo se usa para el permiso (el mismo que la pantalla de
// Plan de Cuentas).
export async function GET(_request: Request, { params }: { params: Promise<{ codUnidad: string }> }) {
  const codUnidad = Number((await params).codUnidad);
  if (!Number.isInteger(codUnidad)) return new Response(null, { status: 400 });

  try {
    await requireAccesoUnidad(codUnidad, "configuracion");
  } catch {
    return new Response(null, { status: 403 });
  }

  const contenido = await generarTablasActuales();
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tablas-actuales-${hoy}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
