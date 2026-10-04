import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });

  const { id } = await params;

  const adjunto = await prisma.reclasificacionAdjunto.findUnique({
    where: { id },
    select: { contenido: true, mimeType: true, nombreArchivo: true },
  });
  if (!adjunto) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(adjunto.contenido), {
    headers: {
      "Content-Type": adjunto.mimeType,
      "Content-Disposition": `inline; filename="${adjunto.nombreArchivo}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
