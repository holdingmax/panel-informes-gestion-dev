import { listReclasificacionesDeEmpresa } from "@/lib/reclasificacion-actions";
import { RecuperarList } from "./RecuperarList";

export const dynamic = "force-dynamic";

const MESES_ABREV = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

export default async function RecuperarReclasificacionPage({
  searchParams,
}: {
  searchParams: Promise<{ empresaId?: string; informeDestinoId?: string }>;
}) {
  const { empresaId, informeDestinoId } = await searchParams;
  if (!empresaId || !informeDestinoId) {
    return <p className="p-6 text-sm text-red-600">Faltan parámetros.</p>;
  }

  const reclasificaciones = await listReclasificacionesDeEmpresa(Number(empresaId));
  // No tiene sentido copiarse a sí misma como "recuperada" — se excluye la
  // del informe que se está trabajando ahora mismo.
  const items = reclasificaciones
    .filter((r) => r.informeId !== informeDestinoId)
    .map((r, i) => ({
      id: r.id,
      numero: reclasificaciones.length - i,
      periodoLabel: `${MESES_ABREV[r.informe.periodoMes - 1]}-${String(r.informe.periodoAnio).slice(-2)}${
        r.informe.version > 1 ? ` v${r.informe.version}` : ""
      }`,
      detalle: r.detalle,
      lineas: r.lineas.map((l) => ({
        planDeCuenta: { cuenta: l.planDeCuenta.cuenta },
        debe: l.debe.toString(),
        haber: l.haber.toString(),
      })),
      adjuntos: r.adjuntos.map((a) => ({ nombreArchivo: a.nombreArchivo })),
    }));

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium">Recuperar Reclasificación</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Elegí una reclasificación de otro período para copiarla completa (líneas y adjuntos) al
        informe que estás trabajando ahora.
      </p>
      <div className="mt-4">
        <RecuperarList items={items} informeDestinoId={informeDestinoId} />
      </div>
    </div>
  );
}
