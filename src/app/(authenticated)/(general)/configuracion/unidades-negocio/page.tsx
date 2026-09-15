import { listUnidadesNegocioConEmpresas, createUnidadNegocio } from "@/lib/unidad-negocio-actions";
import { listEmpresas } from "@/lib/empresa-actions";
import { EmpresasVinculadasForm } from "./EmpresasVinculadasForm";

export const dynamic = "force-dynamic";

export default async function UnidadesNegocioPage() {
  const [unidades, empresas] = await Promise.all([
    listUnidadesNegocioConEmpresas(),
    listEmpresas(),
  ]);

  return (
    <main className="flex w-full max-w-4xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Unidades de Negocio</h1>

      <p className="text-sm text-zinc-600">
        Es lo que se ve en la pantalla principal y con lo que se confecciona un informe. Puede
        combinar el Plan de Cuentas de una o más Empresas (Configuración → Empresas) — cada una
        con su propio BSyS, consolidadas en un solo informe.
      </p>

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Logo</th>
              <th className="py-1 pr-4">Nombre</th>
              <th className="py-1">Empresas vinculadas</th>
            </tr>
          </thead>
          <tbody>
            {unidades.map((unidad) => (
              <tr key={unidad.codUnidad} className="border-t align-top">
                <td className="py-2 pr-4">{unidad.codUnidad}</td>
                <td className="py-2 pr-4">
                  {unidad.imagenMime ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/unidades-negocio/${unidad.codUnidad}/logo`}
                      alt={unidad.nombreUnidad}
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4">{unidad.nombreUnidad}</td>
                <td className="py-2 text-sm">
                  <EmpresasVinculadasForm
                    codUnidad={unidad.codUnidad}
                    empresas={empresas}
                    vinculadasIds={unidad.empresas.map((e) => e.codEmp)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-medium">Nueva unidad de negocio</h2>
        <form action={createUnidadNegocio} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-lg">Nombre (hasta 35 caracteres)</span>
            <input
              name="nombreUnidad"
              required
              maxLength={35}
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-lg">Logo (JPG, PNG, GIF, WebP o SVG)</span>
            <input
              name="imagen"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Crear unidad de negocio
          </button>
        </form>
      </section>
    </main>
  );
}
