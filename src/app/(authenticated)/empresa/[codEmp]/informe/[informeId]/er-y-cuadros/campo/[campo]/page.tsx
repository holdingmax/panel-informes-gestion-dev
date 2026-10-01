import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getDetalleCampoResultado, CAMPO_LABEL, type ResultadoNominal } from "@/lib/resultado-nominal";
import { listCatalog } from "@/lib/catalog-actions";
import { DetalleCampoRow } from "./DetalleCampoRow";

export const dynamic = "force-dynamic";

function fmtParen(n: number) {
  const rounded = Math.round(n);
  return rounded < 0 ? `(${Math.abs(rounded).toLocaleString("es-AR")})` : rounded.toLocaleString("es-AR");
}

const CAMPOS_VALIDOS = Object.keys(CAMPO_LABEL) as (keyof ResultadoNominal)[];

export default async function DetalleCampoResultadoPage({
  params,
}: {
  params: Promise<{ informeId: string; campo: string }>;
}) {
  const { informeId, campo: campoRaw } = await params;
  if (!CAMPOS_VALIDOS.includes(campoRaw as keyof ResultadoNominal)) notFound();
  const campo = campoRaw as keyof ResultadoNominal;

  const [detalle, session, subrubros] = await Promise.all([
    getDetalleCampoResultado(informeId, campo),
    auth(),
    listCatalog("subrubro"),
  ]);
  // Solo mientras el informe no está congelado (Aprobado/Definitivo) — una
  // vez validado, reclasificar una cuenta ya no debe poder tocarlo.
  const puedeEditar = session?.user.role === "ADMIN" && !detalle.congelado;
  const subrubrosOpc = (subrubros as { codSubrubro: number; nomSubrubro: string }[]).map((s) => ({
    codSubrubro: s.codSubrubro,
    nomSubrubro: s.nomSubrubro,
  }));

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium">{detalle.label} — detalle por cuenta</h2>
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
            <th className="py-2 pr-3 font-semibold">Subrubro</th>
            {puedeEditar && <th className="py-2 pr-3 font-semibold">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {detalle.cuentas.map((c) => (
            <DetalleCampoRow
              key={`${c.empresaNombre}-${c.cuenta}`}
              planDeCuentaId={c.planDeCuentaId}
              empresaNombre={c.empresaNombre}
              cuenta={c.cuenta}
              saldoInicio={c.saldoInicio}
              saldoFinal={c.saldoFinal}
              subrubroId={c.subrubroId}
              nomSubrubro={c.nomSubrubro}
              subrubros={subrubrosOpc}
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
