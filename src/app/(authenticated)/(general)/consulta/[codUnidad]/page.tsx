import { notFound } from "next/navigation";
import { getUnidadNegocio } from "@/lib/unidad-negocio-actions";
import { listInformesParaConsulta } from "@/lib/informe-actions";
import { requireAccesoUnidad, permisosDeUnidad } from "@/lib/authz";
import { EstadoBadge } from "./EstadoBadge";
import { ConsultaRowLinks } from "./ConsultaRowLinks";
import { ConsultaAdjuntos } from "./ConsultaAdjuntos";
import { InformeActions } from "@/app/(authenticated)/empresa/[codEmp]/informe/[informeId]/InformeActions";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmtFecha(d: Date) {
  return d.toLocaleDateString("es-AR");
}

export default async function ConsultaUnidadPage({
  params,
}: {
  params: Promise<{ codUnidad: string }>;
}) {
  const { codUnidad: codUnidadRaw } = await params;
  const codUnidad = Number(codUnidadRaw);

  const unidad = await getUnidadNegocio(codUnidad);
  if (!unidad) notFound();

  try {
    await requireAccesoUnidad(codUnidad, "consultar");
  } catch {
    notFound();
  }

  const [informes, permisos] = await Promise.all([
    listInformesParaConsulta(codUnidad),
    permisosDeUnidad(codUnidad),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Consulta — {unidad.nombreUnidad}</h1>

      {informes.length === 0 ? (
        <p className="text-sm text-zinc-600">Todavía no hay informes para esta unidad.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#1f3864] text-white">
              <th className="py-2 pl-3 font-semibold">Fecha confección</th>
              <th className="py-2 font-semibold">Período</th>
              <th className="py-2 font-semibold">Estado</th>
              <th className="py-2 font-semibold">Ver informe</th>
              <th className="py-2 font-semibold">Acciones</th>
              <th className="py-2 pr-3 font-semibold">Adjuntos</th>
            </tr>
          </thead>
          <tbody>
            {informes.map((informe) => {
              const periodoLabel = `${MESES[informe.periodoMes - 1]} ${informe.periodoAnio}${informe.version > 1 ? ` — versión ${informe.version}` : ""}`;
              return (
                <tr key={informe.id} className="border-t border-zinc-200 align-top">
                  <td className="py-2 pl-3">{fmtFecha(informe.createdAt)}</td>
                  <td className="py-2">{periodoLabel}</td>
                  <td className="py-2">
                    <EstadoBadge estado={informe.estado} />
                  </td>
                  <td className="py-2">
                    <ConsultaRowLinks codUnidad={codUnidad} informeId={informe.id} />
                  </td>
                  <td className="py-2">
                    <InformeActions
                      informeId={informe.id}
                      estado={informe.estado}
                      puedeRevisar={permisos.puedeRevisar}
                      puedeAprobar={permisos.puedeAprobar}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <ConsultaAdjuntos
                      informeId={informe.id}
                      adjuntos={informe.adjuntos}
                      puedeAdjuntar={permisos.puedeAdjuntar}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
