import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUnidadNegocio } from "@/lib/unidad-negocio-actions";
import { listEmpresasDeUnidad } from "@/lib/empresa-actions";
import { listCatalog } from "@/lib/catalog-actions";
import { listPlanDeCuentasPorEmpresas, createPlanDeCuentas } from "@/lib/plan-de-cuentas-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { PlanDeCuentasTable } from "./PlanDeCuentasTable";

export const dynamic = "force-dynamic";

export default async function PlanDeCuentasUnidadPage({
  params,
}: {
  params: Promise<{ codUnidad: string }>;
}) {
  const { codUnidad: codUnidadRaw } = await params;
  const codUnidad = Number(codUnidadRaw);

  const unidad = await getUnidadNegocio(codUnidad);
  if (!unidad) notFound();

  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const [empresas, partidas, rubros, subrubros, subrubros2, subrubros3, categorias] =
    await Promise.all([
      listEmpresasDeUnidad(codUnidad),
      listCatalog("partidaPatrimonial"),
      listCatalog("rubro"),
      listCatalog("subrubro"),
      listCatalog("subrubro2"),
      listCatalog("subrubro3"),
      listCatalog("categoriaOyA"),
    ]);

  const empresaIds = empresas.map((e) => e.codEmp);
  const planes = empresaIds.length > 0 ? await listPlanDeCuentasPorEmpresas(empresaIds) : [];

  const filas = planes.map((p) => ({
    id: p.id,
    empresaId: p.empresaId,
    nombreEmpresa: p.empresa.nombreEmp,
    cuenta: p.cuenta,
    partidaPatrimonialId: p.partidaPatrimonialId,
    rubroId: p.rubroId,
    subrubroId: p.subrubroId,
    subrubro2Id: p.subrubro2Id,
    subrubro3Id: p.subrubro3Id,
    categoriaOyAId: p.categoriaOyAId,
    nombrePartida: p.partidaPatrimonial.nomPartida,
    nombreRubro: p.rubro.nomRubro,
    nombreSubrubro: p.subrubro.nomSubrubro,
    nombreSubrubro2: p.subrubro2?.nomSubrubro2 ?? null,
    nombreSubrubro3: p.subrubro3?.nomSubrubro3 ?? null,
    nombreCategoriaOyA: p.categoriaOyA?.nomOyA ?? null,
  }));

  const partidasOpc = (partidas as { codPartida: number; nomPartida: string }[]).map((p) => ({
    id: p.codPartida,
    nombre: p.nomPartida,
  }));
  const rubrosOpc = (rubros as { codRubro: number; nomRubro: string }[]).map((r) => ({
    id: r.codRubro,
    nombre: r.nomRubro,
  }));
  const subrubrosOpc = (subrubros as { codSubrubro: number; nomSubrubro: string }[]).map((s) => ({
    id: s.codSubrubro,
    nombre: s.nomSubrubro,
  }));
  const subrubros2Opc = (subrubros2 as { codSubrubro2: number; nomSubrubro2: string }[]).map(
    (s) => ({ id: s.codSubrubro2, nombre: s.nomSubrubro2 })
  );
  const subrubros3Opc = (subrubros3 as { codSubrubro3: number; nomSubrubro3: string }[]).map(
    (s) => ({ id: s.codSubrubro3, nombre: s.nomSubrubro3 })
  );
  const categoriasOpc = (categorias as { codOyA: number; nomOyA: string }[]).map((c) => ({
    id: c.codOyA,
    nombre: c.nomOyA,
  }));

  return (
    <main className="flex w-full flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Plan de Cuentas — {unidad.nombreUnidad}</h1>

      {empresas.length === 0 ? (
        <p className="text-sm text-red-600">
          Esta unidad de negocio no tiene empresas vinculadas. Vinculá al menos una en
          Configuración → Unidades de Negocio.
        </p>
      ) : (
        <>
          {isAdmin && (
          <CollapsibleAdd label="Agregar cuenta">
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
                  {partidasOpc.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-lg">Rubro</span>
                <select name="rubroId" required className="rounded border px-3 py-2 text-lg">
                  <option value="">Seleccionar...</option>
                  {rubrosOpc.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-lg">Subrubro</span>
                <select name="subrubroId" required className="rounded border px-3 py-2 text-lg">
                  <option value="">Seleccionar...</option>
                  {subrubrosOpc.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-lg">Subrubro 2 (opcional)</span>
                <select name="subrubro2Id" className="rounded border px-3 py-2 text-lg">
                  <option value="">Sin clasificar</option>
                  {subrubros2Opc.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-lg">Subrubro 3 (opcional)</span>
                <select name="subrubro3Id" className="rounded border px-3 py-2 text-lg">
                  <option value="">Sin clasificar</option>
                  {subrubros3Opc.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-lg">Categoría OyA (opcional)</span>
                <select name="categoriaOyAId" className="rounded border px-3 py-2 text-lg">
                  <option value="">Sin clasificar</option>
                  {categoriasOpc.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Agregar cuenta
              </button>
            </form>
          </CollapsibleAdd>
          )}

          <PlanDeCuentasTable
            filas={filas}
            empresas={empresas}
            partidas={partidasOpc}
            rubros={rubrosOpc}
            subrubros={subrubrosOpc}
            subrubros2={subrubros2Opc}
            subrubros3={subrubros3Opc}
            categorias={categoriasOpc}
            isAdmin={isAdmin}
          />
        </>
      )}
    </main>
  );
}
