import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codUnidad: string }> }
) {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });

  const { codUnidad } = await params;

  const unidad = await prisma.unidadNegocio.findUnique({
    where: { codUnidad: Number(codUnidad) },
    select: { imagenUnidad: true, imagenMime: true },
  });

  if (!unidad?.imagenUnidad || !unidad.imagenMime) {
    return new Response(null, { status: 404 });
  }

  return new Response(unidad.imagenUnidad, {
    headers: {
      "Content-Type": unidad.imagenMime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
