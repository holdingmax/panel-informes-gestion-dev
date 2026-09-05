import { prisma } from "@/lib/prisma";
import { BsysUploadForm } from "../BsysUploadForm";

export const dynamic = "force-dynamic";

export default async function BsysAcumuladoPage({
  params,
}: {
  params: Promise<{ codEmp: string }>;
}) {
  const { codEmp } = await params;
  const empresaId = Number(codEmp);

  const ultimaCarga = await prisma.balanceSumasYSaldos.findFirst({
    where: { empresaId, tipo: "ACUMULADO" },
    orderBy: { fechaCarga: "desc" },
    select: { fechaCarga: true },
  });

  const cantidadUltimaCarga = ultimaCarga
    ? await prisma.balanceSumasYSaldos.count({
        where: { empresaId, tipo: "ACUMULADO", fechaCarga: ultimaCarga.fechaCarga },
      })
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Carga de BSyS Acumulado</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Subí el Balance General exportado del sistema contable desde el inicio del
          ejercicio hasta la fecha de análisis. Se valida cada cuenta contra el Plan de
          Cuentas de esta empresa.
        </p>
      </div>

      {ultimaCarga && (
        <p className="text-sm text-zinc-500">
          Última carga: {ultimaCarga.fechaCarga.toLocaleString("es-AR")} (
          {cantidadUltimaCarga} cuentas)
        </p>
      )}

      <BsysUploadForm empresaId={empresaId} tipo="ACUMULADO" />
    </div>
  );
}
