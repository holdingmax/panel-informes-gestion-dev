import { prisma } from "@/lib/prisma";
import { permisosDeUnidad } from "@/lib/authz";
import { listEmpresasDeUnidad } from "@/lib/empresa-actions";
import { listPlanDeCuentasPorEmpresas } from "@/lib/plan-de-cuentas-actions";
import { listReclasificacionesDeInforme } from "@/lib/reclasificacion-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { ReclasificacionForm } from "./ReclasificacionForm";
import { ReclasificacionRow } from "./ReclasificacionRow";
import { AbrirRecuperar } from "./AbrirRecuperar";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function PanelReclasificacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ codEmp: string }>;
  searchParams: Promise<{ mes?: string; anio?: string }>;
}) {
  const { codEmp } = await params;
  const unidadNegocioId = Number(codEmp);
  const now = new Date();
  const sp = await searchParams;
  const periodoMes = Number(sp.mes) || now.getMonth() + 1;
  const periodoAnio = Number(sp.anio) || now.getFullYear();

  const empresas = await listEmpresasDeUnidad(unidadNegocioId);
  const planes = empresas.length > 0 ? await listPlanDeCuentasPorEmpresas(empresas.map((e) => e.codEmp)) : [];
  const cuentasPorEmpresa: Record<number, { id: string; cuenta: string }[]> = {};
  for (const empresa of empresas) {
    cuentasPorEmpresa[empresa.codEmp] = planes
      .filter((p) => p.empresaId === empresa.codEmp)
      .map((p) => ({ id: p.id, cuenta: p.cuenta }))
      .sort((a, b) => a.cuenta.localeCompare(b.cuenta));
  }
  const empresasOpc = empresas.map((e) => ({ codEmp: e.codEmp, nombreEmp: e.nombreEmp }));

  const informe = await prisma.informe.findFirst({
    where: { unidadNegocioId, periodoMes, periodoAnio },
    orderBy: { version: "desc" },
  });

  const reclasificaciones = informe ? await listReclasificacionesDeInforme(informe.id) : [];
  const permisos = await permisosDeUnidad(unidadNegocioId);
  const puedeEditar = informe?.estado === "PROCESO" && permisos.puedeReclasificar;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Panel Reclasificación</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Ajustes extracontables, momentáneos, que mueven saldo entre cuentas solo para la
          exposición del informe de este período — nunca tocan el Plan de Cuentas ni el BSyS
          cargado.
        </p>
      </div>

      <form method="GET" className="flex items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Mes</span>
          <select name="mes" defaultValue={periodoMes} className="rounded border px-3 py-2">
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Año</span>
          <input
            name="anio"
            type="number"
            defaultValue={periodoAnio}
            className="w-24 rounded border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover"
        >
          Ver
        </button>
      </form>

      {!informe ? (
        <p className="text-sm text-red-600">
          Todavía no hay un informe para {MESES[periodoMes - 1]} {periodoAnio}. Confeccionalo
          primero desde &quot;Confeccionar Informe&quot;.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-600">
            {MESES[periodoMes - 1]} {periodoAnio}
            {informe.version > 1 && ` — versión ${informe.version}`} —{" "}
            {puedeEditar ? "En proceso" : "El informe ya no está En proceso: solo lectura"}
          </p>

          {puedeEditar && (
            <div className="flex flex-wrap items-start gap-3">
              <CollapsibleAdd label="Nueva Reclasificación">
                <ReclasificacionForm
                  informeId={informe.id}
                  empresas={empresasOpc}
                  cuentasPorEmpresa={cuentasPorEmpresa}
                />
              </CollapsibleAdd>
              {empresasOpc.map((e) => (
                <AbrirRecuperar
                  key={e.codEmp}
                  unidadNegocioId={unidadNegocioId}
                  empresaId={e.codEmp}
                  informeDestinoId={informe.id}
                />
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-1 pr-3">Fecha</th>
                  <th className="py-1 pr-3">Empresa</th>
                  <th className="py-1 pr-3">Detalle</th>
                  <th className="py-1 pr-3">Líneas / Adjuntos</th>
                  <th className="py-1 pr-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reclasificaciones.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-zinc-600">
                      Todavía no hay reclasificaciones cargadas para este informe.
                    </td>
                  </tr>
                ) : (
                  reclasificaciones.map((r) => (
                    <ReclasificacionRow
                      key={r.id}
                      informeId={informe.id}
                      id={r.id}
                      empresaId={r.empresaId}
                      nombreEmpresa={r.empresa.nombreEmp}
                      detalle={r.detalle}
                      createdAt={r.createdAt.toISOString()}
                      lineas={r.lineas.map((l) => ({
                        planDeCuentaId: l.planDeCuentaId,
                        planDeCuenta: { cuenta: l.planDeCuenta.cuenta },
                        debe: l.debe.toString(),
                        haber: l.haber.toString(),
                      }))}
                      adjuntos={r.adjuntos}
                      puedeEditar={puedeEditar}
                      empresas={empresasOpc}
                      cuentasPorEmpresa={cuentasPorEmpresa}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
