import { prisma } from "@/lib/prisma";
import { BsysUploadForm } from "../BsysUploadForm";

export const dynamic = "force-dynamic";

export default async function BsysMesPage({
  params,
}: {
  params: Promise<{ codEmp: string }>;
}) {
  const { codEmp } = await params;
  const empresaId = Number(codEmp);

  const ultimaCarga = await prisma.balanceSumasYSaldos.findFirst({
    where: { empresaId, tipo: "MES" },
    orderBy: { fechaCarga: "desc" },
    select: { fechaCarga: true },
  });

  const cantidadUltimaCarga = ultimaCarga
    ? await prisma.balanceSumasYSaldos.count({
        where: { empresaId, tipo: "MES", fechaCarga: ultimaCarga.fechaCarga },
      })
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Carga de BSyS Mes</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Subí el Balance General exportado del sistema contable para el mes en curso.
          Se valida cada cuenta contra el Plan de Cuentas de esta empresa.
        </p>
      </div>

      {ultimaCarga && (
        <p className="text-sm text-zinc-500">
          Última carga: {ultimaCarga.fechaCarga.toLocaleString("es-AR")} (
          {cantidadUltimaCarga} cuentas)
        </p>
      )}

      <BsysUploadForm empresaId={empresaId} tipo="MES" />
    </div>
  );
}
