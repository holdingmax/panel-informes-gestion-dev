import { auth } from "@/auth";
import { listEmpresas, createEmpresa } from "@/lib/empresa-actions";
import { listMonedas } from "@/lib/moneda-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { EmpresaRow } from "./EmpresaRow";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const [empresas, monedas] = await Promise.all([listEmpresas(), listMonedas()]);
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Empresas</h1>

      <p className="text-sm text-zinc-600">
        La entidad contable real: tiene su propio Plan de Cuentas y su propio BSyS (Mes y
        Acumulado). Se vincula a una Unidad de Negocio desde Configuración → Unidades de Negocio.
      </p>

      {isAdmin && (
        <CollapsibleAdd label="Crear empresa">
          <form action={createEmpresa} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-lg">Nombre (hasta 60 caracteres)</span>
              <input
                name="nombreEmp"
                required
                maxLength={60}
                className="rounded border px-3 py-2 text-lg"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-lg">Moneda primaria</span>
              <select name="monedaPrimariaId" className="rounded border px-3 py-2 text-lg">
                <option value="">— sin definir —</option>
                {monedas.map((m) => (
                  <option key={m.codMoneda} value={m.codMoneda}>
                    {m.nomMoneda} ({m.simbolo})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-lg">
              <input type="checkbox" name="presentaEnMiles" />
              <span>Presenta en miles</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-lg">Moneda secundaria</span>
              <select name="monedaSecundariaId" className="rounded border px-3 py-2 text-lg">
                <option value="">— sin definir —</option>
                {monedas.map((m) => (
                  <option key={m.codMoneda} value={m.codMoneda}>
                    {m.nomMoneda} ({m.simbolo})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-lg">
              <input type="checkbox" name="actualiza" />
              <span>Actualiza</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-lg">Moneda actualiza</span>
              <select name="monedaActualizaId" className="rounded border px-3 py-2 text-lg">
                <option value="">— sin definir —</option>
                {monedas.map((m) => (
                  <option key={m.codMoneda} value={m.codMoneda}>
                    {m.nomMoneda} ({m.simbolo})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Crear empresa
            </button>
          </form>
        </CollapsibleAdd>
      )}

      <div className="overflow-x-auto rounded-lg bg-white p-4 shadow">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Código</th>
              <th className="py-1 pr-4">Nombre</th>
              <th className="py-1 pr-4">Unidad de Negocio</th>
              <th className="py-1 pr-4">Moneda primaria</th>
              <th className="py-1 pr-4">Presenta en miles</th>
              <th className="py-1 pr-4">Moneda secundaria</th>
              <th className="py-1 pr-4">Actualiza</th>
              <th className="py-1 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => (
              <EmpresaRow
                key={empresa.codEmp}
                codEmp={empresa.codEmp}
                nombreEmp={empresa.nombreEmp}
                unidadNegocioNombre={empresa.unidadNegocio?.nombreUnidad ?? null}
                monedas={monedas}
                monedaPrimaria={empresa.monedaPrimaria}
                presentaEnMiles={empresa.presentaEnMiles}
                monedaSecundaria={empresa.monedaSecundaria}
                actualiza={empresa.actualiza}
                monedaActualiza={empresa.monedaActualiza}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
