import { listInformesDelPeriodo, ultimoPeriodoConInformes } from "@/lib/informe-actions";
import { permisosDeUnidad } from "@/lib/authz";
import { TablaInformesConsulta } from "../TablaInformesConsulta";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Ventana "Informes del período": todos los informes confeccionados en un
// mes/año, de todas las unidades de negocio a las que se tiene acceso, para
// repasarlos de una vez (ej. reunión mensual de Directorio). Es la misma tabla
// de la ventana de cada unidad, con la columna "Unidad de negocio" adelante.
export default async function InformesDelPeriodoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>;
}) {
  const sp = await searchParams;
  const ultimo = await ultimoPeriodoConInformes();
  const hoy = new Date();
  const porDefecto = ultimo ?? { periodoMes: hoy.getMonth() + 1, periodoAnio: hoy.getFullYear() };

  const mesPedido = Number(sp.mes);
  const anioPedido = Number(sp.anio);
  const periodoMes = Number.isInteger(mesPedido) && mesPedido >= 1 && mesPedido <= 12 ? mesPedido : porDefecto.periodoMes;
  const periodoAnio = Number.isInteger(anioPedido) && anioPedido >= 2000 ? anioPedido : porDefecto.periodoAnio;

  const informes = await listInformesDelPeriodo(periodoMes, periodoAnio);

  // Los permisos (revisar, aprobar, adjuntar) dependen de la unidad de cada informe.
  const unidadIds = [...new Set(informes.map((i) => i.unidadNegocioId))];
  const permisosPorUnidad = new Map(
    await Promise.all(unidadIds.map(async (id) => [id, await permisosDeUnidad(id)] as const))
  );

  return (
    <main className="flex w-full flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">
        Informes del período — {MESES[periodoMes - 1]} {periodoAnio}
      </h1>

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
          <input name="anio" type="number" defaultValue={periodoAnio} className="w-24 rounded border px-3 py-2" />
        </label>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Ver
        </button>
      </form>

      {informes.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No hay informes confeccionados en {MESES[periodoMes - 1]} {periodoAnio}.
        </p>
      ) : (
        <TablaInformesConsulta
          mostrarUnidad
          filas={informes.map((informe) => ({
            informe,
            codUnidad: informe.unidadNegocioId,
            nombreUnidad: informe.unidadNegocio.nombreUnidad,
            permisos: permisosPorUnidad.get(informe.unidadNegocioId)!,
          }))}
        />
      )}
    </main>
  );
}
