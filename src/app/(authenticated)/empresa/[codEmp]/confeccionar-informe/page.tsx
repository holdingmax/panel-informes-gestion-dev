import { prisma } from "@/lib/prisma";
import { listEmpresasDeUnidad } from "@/lib/empresa-actions";
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
  const unidadNegocioId = Number(codEmp);

  const empresas = await listEmpresasDeUnidad(unidadNegocioId);

  const ultimasCargas = await Promise.all(
    empresas.map(async (empresa) => ({
      empresa,
      ultimoMes: await ultimaCargaInfo(empresa.codEmp, "MES"),
      ultimoAcumulado: await ultimaCargaInfo(empresa.codEmp, "ACUMULADO"),
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Confeccionar Informe</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Elegí el mes y año, y subí los Balances de Sumas y Saldos exportados del sistema
          contable (Mes y Acumulado) de cada empresa vinculada a esta unidad de negocio para ese
          período. Cada cuenta se valida contra el Plan de Cuentas de su propia empresa.
        </p>
      </div>

      {ultimasCargas.some((c) => c.ultimoMes || c.ultimoAcumulado) && (
        <div className="flex flex-col gap-2 text-sm text-zinc-500">
          {ultimasCargas.map(({ empresa, ultimoMes, ultimoAcumulado }) => (
            <div key={empresa.codEmp}>
              {(ultimoMes || ultimoAcumulado) && (
                <p className="font-medium text-zinc-600">{empresa.nombreEmp}</p>
              )}
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
          ))}
        </div>
      )}

      <BsysUploadForm unidadNegocioId={unidadNegocioId} empresas={empresas} />
    </div>
  );
}
