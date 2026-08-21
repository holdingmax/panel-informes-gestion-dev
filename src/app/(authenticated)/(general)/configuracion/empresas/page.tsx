import { listEmpresas, createEmpresa } from "@/lib/empresa-actions";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const empresas = await listEmpresas();

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Empresas</h1>

      <table className="w-full text-left text-lg">
        <thead>
          <tr>
            <th className="py-1">Código</th>
            <th className="py-1">Logo</th>
            <th className="py-1">Nombre</th>
          </tr>
        </thead>
        <tbody>
          {empresas.map((empresa) => (
            <tr key={empresa.codEmp} className="border-t">
              <td className="py-2">{empresa.codEmp}</td>
              <td className="py-2">
                {empresa.imagenMime ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/empresas/${empresa.codEmp}/logo`}
                    alt={empresa.nombreEmp}
                    className="h-10 w-10 object-contain"
                  />
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2">{empresa.nombreEmp}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-medium">Nueva empresa</h2>
        <form action={createEmpresa} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-lg">Nombre (hasta 35 caracteres)</span>
            <input
              name="nombreEmp"
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
            className="rounded bg-black px-3 py-2 text-lg text-white"
          >
            Crear empresa
          </button>
        </form>
      </section>
    </main>
  );
}
