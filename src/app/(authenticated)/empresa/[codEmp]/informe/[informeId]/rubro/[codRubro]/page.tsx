import { getDetalleRubro } from "@/lib/balance-oya-report";
import { listRubrosConClasificacion } from "@/lib/rubro-actions";
import { permisosDeInforme } from "@/lib/authz";
import { DetalleRubroRow } from "./DetalleRubroRow";

export const dynamic = "force-dynamic";

function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

export default async function DetalleRubroPage({
  params,
  searchParams,
}: {
  params: Promise<{ informeId: string; codRubro: string }>;
  searchParams: Promise<{ soloLectura?: string }>;
}) {
  const { informeId, codRubro } = await params;
  const { soloLectura } = await searchParams;
  const [detalle, permisos, rubros] = await Promise.all([
    getDetalleRubro(informeId, Number(codRubro)),
    permisosDeInforme(informeId),
    listRubrosConClasificacion(),
  ]);
  // Solo mientras el informe no está congelado (Aprobado) — una vez
  // validado, reclasificar una cuenta ya no debe poder tocarlo. Tampoco en
  // la vista de solo lectura de Consulta (soloLectura=1), aunque el informe
  // siga en Proceso.
  const puedeEditar = permisos.puedeConfiguracion && !detalle.congelado && soloLectura !== "1";
  const rubrosOpc = rubros.map((r) => ({ codRubro: r.codRubro, nomRubro: r.nomRubro }));

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium">{detalle.nomRubro} — detalle por cuenta</h2>
      {detalle.congelado && (
        <p className="mt-1 text-sm text-zinc-600">
          Este informe ya está validado — la clasificación quedó congelada y no se puede editar.
        </p>
      )}
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="bg-[#1f3864] text-white">
            <th className="py-2 pl-3 font-semibold">Empresa</th>
            <th className="py-2 font-semibold">Cuenta</th>
            <th className="py-2 pr-3 text-right font-semibold">Saldo Final</th>
            <th className="py-2 pr-3 text-right font-semibold">Saldo Inicio</th>
            <th className="py-2 pr-3 font-semibold">Rubro</th>
            {puedeEditar && <th className="py-2 pr-3 font-semibold">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {detalle.cuentas.map((c) => (
            <DetalleRubroRow
              key={`${c.empresaNombre}-${c.cuenta}`}
              planDeCuentaId={c.planDeCuentaId}
              empresaNombre={c.empresaNombre}
              cuenta={c.cuenta}
              saldoInicio={c.saldoInicio}
              saldoFinal={c.saldoFinal}
              rubroId={c.rubroId}
              nomRubro={c.nomRubro}
              rubros={rubrosOpc}
              puedeEditar={puedeEditar}
            />
          ))}
          <tr className="border-t-2 border-zinc-400 bg-yellow-100 font-semibold">
            <td className="py-1 pl-3" colSpan={2}>
              Total
            </td>
            <td className="py-1 pr-3 text-right">{fmtParen(detalle.totalSaldoFinal)}</td>
            <td className="py-1 pr-3 text-right">{fmtParen(detalle.totalSaldoInicio)}</td>
            <td colSpan={puedeEditar ? 2 : 1} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
