import { getDetalleRubro } from "@/lib/balance-oya-report";

export const dynamic = "force-dynamic";

function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

export default async function DetalleRubroPage({
  params,
}: {
  params: Promise<{ informeId: string; codRubro: string }>;
}) {
  const { informeId, codRubro } = await params;
  const detalle = await getDetalleRubro(informeId, Number(codRubro));

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium">{detalle.nomRubro} — detalle por cuenta</h2>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="bg-[#1f3864] text-white">
            <th className="py-2 pl-3 font-semibold">Empresa</th>
            <th className="py-2 font-semibold">Cuenta</th>
            <th className="py-2 pr-3 text-right font-semibold">Saldo Final</th>
            <th className="py-2 pr-3 text-right font-semibold">Saldo Inicio</th>
          </tr>
        </thead>
        <tbody>
          {detalle.cuentas.map((c) => (
            <tr key={`${c.empresaNombre}-${c.cuenta}`} className="border-t border-zinc-200">
              <td className="py-1 pl-3">{c.empresaNombre}</td>
              <td className="py-1">{c.cuenta}</td>
              <td className="py-1 pr-3 text-right">{fmtParen(c.saldoFinal)}</td>
              <td className="py-1 pr-3 text-right">{fmtParen(c.saldoInicio)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-zinc-400 bg-yellow-100 font-semibold">
            <td className="py-1 pl-3" colSpan={2}>
              Total
            </td>
            <td className="py-1 pr-3 text-right">{fmtParen(detalle.totalSaldoFinal)}</td>
            <td className="py-1 pr-3 text-right">{fmtParen(detalle.totalSaldoInicio)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
