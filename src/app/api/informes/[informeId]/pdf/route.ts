import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { computeInformeReport } from "@/lib/balance-oya-report";
import { InformePDF } from "@/lib/informe-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ informeId: string }> }
) {
  const { informeId } = await params;

  const informe = await prisma.informe.findUnique({ where: { id: informeId } });
  if (!informe) return new Response(null, { status: 404 });

  if (informe.estado !== "APROBADO" && informe.estado !== "DEFINITIVO") {
    return new Response("El informe todavía no fue aprobado.", { status: 403 });
  }

  const report = await computeInformeReport(informeId);
  const buffer = await renderToBuffer(InformePDF({ report }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="informe-${report.empresaNombre}-${report.periodoMes}-${report.periodoAnio}.pdf"`,
    },
  });
}
