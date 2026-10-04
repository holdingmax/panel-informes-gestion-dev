import { prisma } from "@/lib/prisma";
import { requireAccesoUnidad } from "@/lib/authz";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const adjunto = await prisma.informeAdjunto.findUnique({
    where: { id },
    select: {
      contenido: true,
      mimeType: true,
      nombreArchivo: true,
      informe: { select: { unidadNegocioId: true } },
    },
  });
  if (!adjunto) return new Response(null, { status: 404 });

  try {
    await requireAccesoUnidad(adjunto.informe.unidadNegocioId);
  } catch {
    return new Response(null, { status: 403 });
  }

  return new Response(new Uint8Array(adjunto.contenido), {
    headers: {
      "Content-Type": adjunto.mimeType,
      "Content-Disposition": `inline; filename="${adjunto.nombreArchivo}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
