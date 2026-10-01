import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getUnidadNegocio } from "@/lib/unidad-negocio-actions";
import { listEmpresasDeUnidad } from "@/lib/empresa-actions";
import { listCatalog } from "@/lib/catalog-actions";
import { listRubrosConClasificacion } from "@/lib/rubro-actions";
import { listPlanDeCuentasPorEmpresas } from "@/lib/plan-de-cuentas-actions";
import { CollapsibleAdd } from "@/components/CollapsibleAdd";
import { PlanDeCuentasTable } from "./PlanDeCuentasTable";
import { AgregarCuentaForm } from "./AgregarCuentaForm";

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

  const [empresas, rubros, subrubros, subrubros2, subrubros3, categorias] =
    await Promise.all([
      listEmpresasDeUnidad(codUnidad),
      listRubrosConClasificacion(),
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
    rubroId: p.rubroId,
    subrubroId: p.subrubroId,
    subrubro2Id: p.subrubro2Id,
    subrubro3Id: p.subrubro3Id,
    categoriaOyAId: p.categoriaOyAId,
    nombrePartida: p.rubro.partidaPatrimonial?.nomPartida ?? null,
    nombreRubro: p.rubro.nomRubro,
    nombreSubrubro: p.subrubro?.nomSubrubro ?? null,
    nombreSubrubro2: p.subrubro2?.nomSubrubro2 ?? null,
    nombreSubrubro3: p.subrubro3?.nomSubrubro3 ?? null,
    nombreCategoriaOyA: p.categoriaOyA?.nomOyA ?? null,
  }));

  // Subrubro es exclusivo de Rubros de Partida Resultado (Ingresos/Egresos)
  // — el formulario usa esResultado para mostrar Subrubro o Subrubro2/3.
  const rubrosOpc = rubros.map((r) => ({
    id: r.codRubro,
    nombre: r.nomRubro,
    esResultado: r.partidaPatrimonial?.tipo?.rol === "RESULTADO",
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
            <AgregarCuentaForm
              empresas={empresas}
              rubros={rubrosOpc}
              subrubros={subrubrosOpc}
              subrubros2={subrubros2Opc}
              subrubros3={subrubros3Opc}
              categorias={categoriasOpc}
            />
          </CollapsibleAdd>
          )}

          <PlanDeCuentasTable
            filas={filas}
            empresas={empresas}
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
