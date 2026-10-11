import { listInformes } from "@/lib/informe-actions";
import { permisosDeUnidad } from "@/lib/authz";
import { HistoricoRowLinks } from "./HistoricoRowLinks";
import { InformeAcciones } from "./InformeAcciones";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const ESTADO_LABEL: Record<string, string> = {
  PROCESO: "En proceso",
  EN_REVISION: "En revisión",
  APROBADO: "Aprobado",
};

export default async function HistoricoPage({
  params,
}: {
  params: Promise<{ codEmp: string }>;
}) {
  const { codEmp } = await params;
  const [informes, permisos] = await Promise.all([
    listInformes(Number(codEmp)),
    permisosDeUnidad(Number(codEmp)),
  ]);

  return (
    <div>
      <h2 className="text-lg font-medium">Histórico de Informes</h2>

      {informes.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">
          Todavía no hay informes. Se crean automáticamente al cargar BSyS Mes o Acumulado.
        </p>
      ) : (
        <table className="mt-4 w-full max-w-3xl text-left text-sm">
          <thead>
            <tr>
              <th className="py-1">Período</th>
              <th className="py-1">Estado</th>
              <th className="py-1">Ver informe</th>
              <th className="py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {informes.map((informe) => {
              const periodoLabel = `${MESES[informe.periodoMes - 1]} ${informe.periodoAnio}${informe.version > 1 ? ` — versión ${informe.version}` : ""}`;
              return (
                <tr key={informe.id} className="border-t">
                  <td className="py-2">{periodoLabel}</td>
                  <td className="py-2">{ESTADO_LABEL[informe.estado] ?? informe.estado}</td>
                  <td className="py-2">
                    <HistoricoRowLinks codEmp={codEmp} informeId={informe.id} />
                  </td>
                  <td className="py-2">
                    <InformeAcciones
                      codEmp={codEmp}
                      informeId={informe.id}
                      estado={informe.estado}
                      periodoLabel={periodoLabel}
                      puedeEditar={permisos.puedeConfeccionar}
                      puedeEliminar={permisos.puedeEliminar}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
