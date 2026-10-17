import type { PermisosUnidad } from "@/lib/authz";
import { EstadoBadge } from "./[codUnidad]/EstadoBadge";
import { ConsultaRowLinks } from "./[codUnidad]/ConsultaRowLinks";
import { ConsultaAdjuntos } from "./[codUnidad]/ConsultaAdjuntos";
import { PresentacionButton } from "./PresentacionButton";
import { InformeActions } from "@/app/(authenticated)/empresa/[codEmp]/informe/[informeId]/InformeActions";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmtFecha(d: Date) {
  return d.toLocaleDateString("es-AR");
}

export type FilaConsulta = {
  informe: {
    id: string;
    createdAt: Date;
    periodoMes: number;
    periodoAnio: number;
    version: number;
    estado: string;
    adjuntos: { id: string; nombreArchivo: string; mimeType: string }[];
  };
  codUnidad: number;
  nombreUnidad: string;
  permisos: PermisosUnidad;
};

// Tabla de informes de la ventana Consulta: la usan la ventana de una unidad y
// la ventana "Informes del período" (todas las unidades), que es la misma
// tabla con una primera columna más, "Unidad de negocio".
export function TablaInformesConsulta({
  filas,
  mostrarUnidad = false,
}: {
  filas: FilaConsulta[];
  mostrarUnidad?: boolean;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="bg-[#1f3864] text-white">
          {mostrarUnidad && <th className="py-2 pl-3 font-semibold">Unidad de negocio</th>}
          <th className={`py-2 font-semibold ${mostrarUnidad ? "" : "pl-3"}`}>Fecha confección</th>
          <th className="py-2 font-semibold">Período</th>
          <th className="py-2 font-semibold">Estado</th>
          <th className="py-2 font-semibold">Ver informe</th>
          <th className="py-2 font-semibold">Acciones</th>
          <th className="py-2 pr-3 font-semibold">Adjuntos</th>
        </tr>
      </thead>
      <tbody>
        {filas.map(({ informe, codUnidad, nombreUnidad, permisos }) => {
          const periodoLabel = `${MESES[informe.periodoMes - 1]} ${informe.periodoAnio}${informe.version > 1 ? ` — versión ${informe.version}` : ""}`;
          return (
            <tr key={informe.id} className="border-t border-zinc-200 align-top">
              {mostrarUnidad && <td className="py-2 pl-3 font-medium">{nombreUnidad}</td>}
              <td className={`py-2 ${mostrarUnidad ? "" : "pl-3"}`}>{fmtFecha(informe.createdAt)}</td>
              <td className="py-2">{periodoLabel}</td>
              <td className="py-2">
                <EstadoBadge estado={informe.estado} />
              </td>
              <td className="py-2">
                <div className="flex flex-col items-start gap-2">
                  <ConsultaRowLinks codUnidad={codUnidad} informeId={informe.id} />
                  <PresentacionButton
                    informeId={informe.id}
                    titulo={`${nombreUnidad} — ${periodoLabel}`}
                    estado={informe.estado}
                    adjuntos={informe.adjuntos}
                  />
                </div>
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
  );
}
