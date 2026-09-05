import { listEmpresas } from "@/lib/empresa-actions";
import { listCatalog } from "@/lib/catalog-actions";
import {
  listPlanDeCuentas,
  createPlanDeCuentas,
} from "@/lib/plan-de-cuentas-actions";

export const dynamic = "force-dynamic";

export default async function PlanDeCuentasPage() {
  const [planes, empresas, partidas, rubros, subrubros, subrubros2, subrubros3, categorias] =
    await Promise.all([
      listPlanDeCuentas(),
      listEmpresas(),
      listCatalog("partidaPatrimonial"),
      listCatalog("rubro"),
      listCatalog("subrubro"),
      listCatalog("subrubro2"),
      listCatalog("subrubro3"),
      listCatalog("categoriaOyA"),
    ]);

  return (
    <main className="flex w-full max-w-5xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Plan de Cuentas</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-lg">
          <thead>
            <tr>
              <th className="py-1 pr-4">Empresa</th>
              <th className="py-1 pr-4">Cuenta</th>
              <th className="py-1 pr-4">Partida</th>
              <th className="py-1 pr-4">Rubro</th>
              <th className="py-1 pr-4">Subrubro</th>
              <th className="py-1 pr-4">Subrubro 2</th>
              <th className="py-1 pr-4">Subrubro 3</th>
              <th className="py-1 pr-4">Categoría OyA</th>
            </tr>
          </thead>
          <tbody>
            {planes.map((plan) => (
              <tr key={plan.id} className="border-t">
                <td className="py-2 pr-4">{plan.empresa.nombreEmp}</td>
                <td className="py-2 pr-4">{plan.cuenta}</td>
                <td className="py-2 pr-4">{plan.partidaPatrimonial.nomPartida}</td>
                <td className="py-2 pr-4">{plan.rubro.nomRubro}</td>
                <td className="py-2 pr-4">{plan.subrubro.nomSubrubro}</td>
                <td className="py-2 pr-4">{plan.subrubro2?.nomSubrubro2 ?? "—"}</td>
                <td className="py-2 pr-4">{plan.subrubro3?.nomSubrubro3 ?? "—"}</td>
                <td className="py-2 pr-4">{plan.categoriaOyA?.nomOyA ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-medium">Nueva cuenta</h2>
        <form action={createPlanDeCuentas} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-lg">Empresa</span>
            <select name="empresaId" required className="rounded border px-3 py-2 text-lg">
              <option value="">Seleccionar...</option>
              {empresas.map((empresa) => (
                <option key={empresa.codEmp} value={empresa.codEmp}>
                  {empresa.nombreEmp}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-lg">Cuenta (hasta 90 caracteres)</span>
            <input name="cuenta" required maxLength={90} className="rounded border px-3 py-2 text-lg" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-lg">Partida Patrimonial</span>
            <select name="partidaPatrimonialId" required className="rounded border px-3 py-2 text-lg">
              <option value="">Seleccionar...</option>
              {partidas.map((p: { codPartida: number; nomPartida: string }) => (
                <option key={p.codPartida} value={p.codPartida}>
                  {p.nomPartida}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-lg">Rubro</span>
            <select name="rubroId" required className="rounded border px-3 py-2 text-lg">
              <option value="">Seleccionar...</option>
              {rubros.map((r: { codRubro: number; nomRubro: string }) => (
                <option key={r.codRubro} value={r.codRubro}>
                  {r.nomRubro}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-lg">Subrubro</span>
            <select name="subrubroId" required className="rounded border px-3 py-2 text-lg">
              <option value="">Seleccionar...</option>
              {subrubros.map((s: { codSubrubro: number; nomSubrubro: string }) => (
                <option key={s.codSubrubro} value={s.codSubrubro}>
                  {s.nomSubrubro}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-lg">Subrubro 2 (opcional)</span>
            <select name="subrubro2Id" className="rounded border px-3 py-2 text-lg">
              <option value="">Sin clasificar</option>
              {subrubros2.map((s: { codSubrubro2: number; nomSubrubro2: string }) => (
                <option key={s.codSubrubro2} value={s.codSubrubro2}>
                  {s.nomSubrubro2}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-lg">Subrubro 3 (opcional)</span>
            <select name="subrubro3Id" className="rounded border px-3 py-2 text-lg">
              <option value="">Sin clasificar</option>
              {subrubros3.map((s: { codSubrubro3: number; nomSubrubro3: string }) => (
                <option key={s.codSubrubro3} value={s.codSubrubro3}>
                  {s.nomSubrubro3}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-lg">Categoría OyA (opcional)</span>
            <select name="categoriaOyAId" className="rounded border px-3 py-2 text-lg">
              <option value="">Sin clasificar</option>
              {categorias.map((c: { codOyA: number; nomOyA: string }) => (
                <option key={c.codOyA} value={c.codOyA}>
                  {c.nomOyA}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-lg text-white"
          >
            Agregar cuenta
          </button>
        </form>
      </section>
    </main>
  );
}
