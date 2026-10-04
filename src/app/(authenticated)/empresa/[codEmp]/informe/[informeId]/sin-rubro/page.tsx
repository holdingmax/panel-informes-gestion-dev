import { getCuentasSinRubro } from "@/lib/balance-oya-report";
import { listRubrosConClasificacion } from "@/lib/rubro-actions";
import { permisosDeInforme } from "@/lib/authz";
import { DetalleSinRubroRow } from "./DetalleSinRubroRow";

export const dynamic = "force-dynamic";

function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

export default async function SinRubroPage({
  params,
  searchParams,
}: {
  params: Promise<{ informeId: string }>;
  searchParams: Promise<{ soloLectura?: string }>;
}) {
  const { informeId } = await params;
  const { soloLectura } = await searchParams;
  const [detalle, permisos, rubros] = await Promise.all([
    getCuentasSinRubro(informeId),
    permisosDeInforme(informeId),
    listRubrosConClasificacion(),
  ]);
  const puedeEditar = permisos.puedeConfiguracion && !detalle.congelado && soloLectura !== "1";
  const rubrosOpc = rubros.map((r) => ({ codRubro: r.codRubro, nomRubro: r.nomRubro }));

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium">Cuentas sin Rubro — detalle</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Estas cuentas tienen saldo este período pero no están clasificadas con un Rubro ni un
        Subrubro — no entran al Estado de Situación Patrimonial. Asignales un Rubro acá si
        corresponde (si son cuentas de Resultado, clasificalas por Subrubro en Configuración →
        Plan de Cuentas en su lugar).
      </p>
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
            {puedeEditar && <th className="py-2 pr-3 font-semibold">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {detalle.cuentas.map((c) => (
            <DetalleSinRubroRow
              key={`${c.empresaNombre}-${c.cuenta}`}
              planDeCuentaId={c.planDeCuentaId}
              empresaNombre={c.empresaNombre}
              cuenta={c.cuenta}
              saldoInicio={c.saldoInicio}
              saldoFinal={c.saldoFinal}
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
            {puedeEditar && <td />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
