import { renderToBuffer } from "@react-pdf/renderer";
import { requireAccesoUnidad } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { computeInformeReport } from "@/lib/balance-oya-report";
import { computeResultadoCuadro } from "@/lib/resultado-cuadro";
import { InformePDF } from "@/lib/informe-pdf";

// PDF del informe. Aprobado: el informe definitivo (el mismo de Consulta y del
// Histórico). En cualquier otro estado se genera con los datos y el gráfico que
// hay hasta ese momento, marcado en todas las hojas como NO APROBADO (ver
// InformePDF). Con ?descargar=1 el navegador lo baja en vez de abrirlo.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ informeId: string }> }
) {
  const { informeId } = await params;

  const informe = await prisma.informe.findUnique({ where: { id: informeId } });
  if (!informe) return new Response(null, { status: 404 });

  try {
    // Alcanza con tener acceso a la unidad desde Consulta o desde Preparación
    // de informes: ambas pantallas ofrecen esta descarga.
    await requireAccesoUnidad(informe.unidadNegocioId);
  } catch {
    return new Response(null, { status: 403 });
  }

  const [report, cuadro] = await Promise.all([
    computeInformeReport(informeId),
    computeResultadoCuadro(informeId),
  ]);
  const buffer = await renderToBuffer(InformePDF({ report, cuadro }));

  const sufijo = informe.estado === "APROBADO" ? "" : "-NO-APROBADO";
  const disposicion = new URL(request.url).searchParams.get("descargar") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposicion}; filename="informe-${report.unidadNegocioNombre}-${report.periodoMes}-${report.periodoAnio}${sufijo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
