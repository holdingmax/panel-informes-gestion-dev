import { auth } from "@/auth";
import { listTiposPartida, createTipoPartida } from "@/lib/tipo-partida-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { TipoPartidaRow } from "./TipoPartidaRow";

export const dynamic = "force-dynamic";

export default async function TipoPartidaPage() {
  const tipos = await listTiposPartida();
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Tipo de Partida</h1>

      <p className="text-sm text-zinc-600">
        Acá se administran los valores que puede tomar el campo &quot;Tipo&quot; de cada Partida
        Patrimonial (Configuración → Partida Patrimonial). El &quot;Rol&quot; le dice al motor de
        informes en qué bucket entra ese Tipo: Activo/Pasivo/Patrimonio Neto van al Balance,
        Resultado al Estado de Resultados. Un Tipo puede quedar &quot;Sin rol&quot; — queda afuera
        del Balance y del Resultado (por ejemplo, Cuenta de Orden). Si además marcás &quot;Exige
        saldo cero&quot;, el sistema va a avisar al operador al armar el informe si alguna vez esa
        clasificación no netea a cero, en vez de dejarlo pasar en silencio.
      </p>

      {isAdmin && (
        <CollapsibleAdd>
          <form action={createTipoPartida} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-lg">Nombre (hasta 40 caracteres)</span>
              <input name="nomTipo" required maxLength={40} className="rounded border px-3 py-2 text-lg" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-lg">Rol</span>
              <select name="rol" className="rounded border px-3 py-2 text-lg">
                <option value="">Sin rol (fuera del Balance/Resultado)</option>
                <option value="ACTIVO">Activo (Balance)</option>
                <option value="PASIVO">Pasivo (Balance)</option>
                <option value="PATRIMONIO_NETO">Patrimonio Neto (Balance)</option>
                <option value="RESULTADO">Resultado (Ingresos/Egresos)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-lg">
              <input type="checkbox" name="exigeSaldoCero" className="h-5 w-5" />
              <span>Exige saldo cero (ej. Cuenta de Orden)</span>
            </label>
            <button
              type="submit"
              className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Agregar
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
              <th className="py-1 pr-4">Rol</th>
              <th className="py-1 pr-4">Exige saldo cero</th>
              <th className="py-1 pr-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((tipo) => (
              <TipoPartidaRow
                key={tipo.codTipo}
                codTipo={tipo.codTipo}
                nomTipo={tipo.nomTipo}
                rol={tipo.rol}
                exigeSaldoCero={tipo.exigeSaldoCero}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
