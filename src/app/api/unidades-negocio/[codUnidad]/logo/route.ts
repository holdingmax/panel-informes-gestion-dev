import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codUnidad: string }> }
) {
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
      "Cache-Control": "public, max-age=3600",
    },
  });
}
