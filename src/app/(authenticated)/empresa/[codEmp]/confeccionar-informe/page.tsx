import { prisma } from "@/lib/prisma";
import { listEmpresasDeUnidad } from "@/lib/empresa-actions";
import { listPlanDeCuentasPorEmpresas } from "@/lib/plan-de-cuentas-actions";
import { BsysUploadForm } from "../BsysUploadForm";

export const dynamic = "force-dynamic";

const MESES_ABREV = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

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

  const planes =
    empresas.length > 0
      ? await listPlanDeCuentasPorEmpresas(empresas.map((e) => e.codEmp))
      : [];
  // La cuenta de RNA (Resultados No Asignados) siempre es una cuenta de
  // Patrimonio Neto, cuyo código empieza con "3" en el plan de cuentas de
  // todas las empresas — se acota la lista para que el operador no tenga que
  // buscarla entre cientos de cuentas de Activo/Pasivo/Resultado.
  const cuentasPorEmpresa: Record<number, string[]> = {};
  for (const empresa of empresas) {
    cuentasPorEmpresa[empresa.codEmp] = planes
      .filter((p) => p.empresaId === empresa.codEmp && p.cuenta.trim().startsWith("3"))
      .map((p) => p.cuenta)
      .sort();
  }

  const ultimasCargas = await Promise.all(
    empresas.map(async (empresa) => ({
      empresa,
      ultimoMes: await ultimaCargaInfo(empresa.codEmp, "MES"),
      ultimoAcumulado: await ultimaCargaInfo(empresa.codEmp, "ACUMULADO"),
    }))
  );

  // Volver a confeccionar un período cuya última versión ya está Aprobada
  // no la pisa — crea una versión nueva (ver bsys-import.ts). Se avisa acá,
  // antes de subir nada, para que no sea una sorpresa.
  const todosLosInformes = await prisma.informe.findMany({
    where: { unidadNegocioId },
    orderBy: { version: "desc" },
    select: { periodoMes: true, periodoAnio: true, version: true, estado: true },
  });
  const ultimaVersionPorPeriodo = new Map<string, (typeof todosLosInformes)[number]>();
  for (const i of todosLosInformes) {
    const key = `${i.periodoAnio}-${i.periodoMes}`;
    if (!ultimaVersionPorPeriodo.has(key)) ultimaVersionPorPeriodo.set(key, i);
  }
  const periodosQueVersionarian = [...ultimaVersionPorPeriodo.values()]
    .filter((i) => i.estado === "APROBADO")
    .sort((a, b) => b.periodoAnio - a.periodoAnio || b.periodoMes - a.periodoMes);

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

      {periodosQueVersionarian.length > 0 && (
        <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">
            Estos períodos ya tienen un informe Aprobado — volver a confeccionarlos no lo pisa,
            crea una versión nueva:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {periodosQueVersionarian.map((i) => (
              <li key={`${i.periodoAnio}-${i.periodoMes}`}>
                {MESES_ABREV[i.periodoMes - 1]}-{String(i.periodoAnio).slice(-2)} (versión actual:{" "}
                {i.version} → la próxima carga sería la versión {i.version + 1})
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <BsysUploadForm
        unidadNegocioId={unidadNegocioId}
        empresas={empresas}
        cuentasPorEmpresa={cuentasPorEmpresa}
      />
    </div>
  );
}
