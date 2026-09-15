import { listEmpresas, createEmpresa } from "@/lib/empresa-actions";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const empresas = await listEmpresas();

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Empresas</h1>

      <p className="text-sm text-zinc-600">
        La entidad contable real: tiene su propio Plan de Cuentas y su propio BSyS (Mes y
        Acumulado). Se vincula a una Unidad de Negocio desde Configuración → Unidades de Negocio.
      </p>

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Nombre</th>
              <th className="py-1">Unidad de Negocio</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => (
              <tr key={empresa.codEmp} className="border-t">
                <td className="py-2 pr-4">{empresa.codEmp}</td>
                <td className="py-2 pr-4">{empresa.nombreEmp}</td>
                <td className="py-2">{empresa.unidadNegocio?.nombreUnidad ?? "— sin vincular —"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex max-w-md flex-col gap-4 rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-medium">Nueva empresa</h2>
        <form action={createEmpresa} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-lg">Nombre (hasta 60 caracteres)</span>
            <input
              name="nombreEmp"
              required
              maxLength={60}
              className="rounded border px-3 py-2 text-lg"
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Crear empresa
          </button>
        </form>
      </section>
    </main>
  );
}
