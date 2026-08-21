import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codEmp: string }> }
) {
  const { codEmp } = await params;

  const empresa = await prisma.empresa.findUnique({
    where: { codEmp: Number(codEmp) },
    select: { imagenEmp: true, imagenMime: true },
  });

  if (!empresa?.imagenEmp || !empresa.imagenMime) {
    return new Response(null, { status: 404 });
  }

  return new Response(empresa.imagenEmp, {
    headers: {
      "Content-Type": empresa.imagenMime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
