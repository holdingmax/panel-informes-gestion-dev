import { notFound } from "next/navigation";
import { getUnidadNegocio } from "@/lib/unidad-negocio-actions";
import { listInformesParaConsulta } from "@/lib/informe-actions";
import { requireAccesoUnidad, permisosDeUnidad } from "@/lib/authz";
import { TablaInformesConsulta } from "../TablaInformesConsulta";

export const dynamic = "force-dynamic";

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
        <TablaInformesConsulta
          filas={informes.map((informe) => ({
            informe,
            codUnidad,
            nombreUnidad: unidad.nombreUnidad,
            permisos,
          }))}
        />
      )}
    </main>
  );
}
