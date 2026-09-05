import { prisma } from "@/lib/prisma";
import { BsysUploadForm } from "../BsysUploadForm";

export const dynamic = "force-dynamic";

async function ultimaCargaInfo(empresaId: number, tipo: "MES" | "ACUMULADO") {
  const ultimaCarga = await prisma.balanceSumasYSaldos.findFirst({
    where: { empresaId, tipo },
    orderBy: { fechaCarga: "desc" },
    select: { fechaCarga: true },
  });
  if (!ultimaCarga) return null;

  const cantidad = await prisma.balanceSumasYSaldos.count({
    where: { empresaId, tipo, fechaCarga: ultimaCarga.fechaCarga },
  });
  return { fecha: ultimaCarga.fechaCarga, cantidad };
}

export default async function ConfeccionarInformePage({
  params,
}: {
  params: Promise<{ codEmp: string }>;
}) {
  const { codEmp } = await params;
  const empresaId = Number(codEmp);

  const [ultimoMes, ultimoAcumulado] = await Promise.all([
    ultimaCargaInfo(empresaId, "MES"),
    ultimaCargaInfo(empresaId, "ACUMULADO"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Confeccionar Informe</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Elegí el mes y año, y subí los dos Balances de Sumas y Saldos exportados del sistema
          contable (Mes y Acumulado) para ese período. Cada cuenta se valida contra el Plan de
          Cuentas de esta empresa.
        </p>
      </div>

      {(ultimoMes || ultimoAcumulado) && (
        <div className="flex flex-col gap-1 text-sm text-zinc-500">
          {ultimoMes && (
            <p>
              Última carga BSyS Mes: {ultimoMes.fecha.toLocaleString("es-AR")} (
              {ultimoMes.cantidad} cuentas)
            </p>
          )}
          {ultimoAcumulado && (
            <p>
              Última carga BSyS Acumulado: {ultimoAcumulado.fecha.toLocaleString("es-AR")} (
              {ultimoAcumulado.cantidad} cuentas)
            </p>
          )}
        </div>
      )}

      <BsysUploadForm empresaId={empresaId} />
    </div>
  );
}
