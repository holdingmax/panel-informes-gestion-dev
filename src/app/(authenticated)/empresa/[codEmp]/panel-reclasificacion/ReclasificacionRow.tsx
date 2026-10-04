"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkDeleteReclasificacion, deleteReclasificacion } from "@/lib/reclasificacion-actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { ReclasificacionForm } from "./ReclasificacionForm";

type CuentaOpcion = { id: string; cuenta: string };

export function ReclasificacionRow({
  informeId,
  id,
  empresaId,
  nombreEmpresa,
  detalle,
  createdAt,
  lineas,
  adjuntos,
  puedeEditar,
  empresas,
  cuentasPorEmpresa,
}: {
  informeId: string;
  id: string;
  empresaId: number;
  nombreEmpresa: string;
  detalle: string;
  createdAt: string;
  lineas: { planDeCuentaId: string; planDeCuenta: { cuenta: string }; debe: string; haber: string }[];
  adjuntos: { id: string; nombreArchivo: string }[];
  puedeEditar: boolean;
  empresas: { codEmp: number; nombreEmp: string }[];
  cuentasPorEmpresa: Record<number, CuentaOpcion[]>;
}) {
  const [editando, setEditando] = useState(false);
  const router = useRouter();

  if (editando) {
    return (
      <tr className="border-t align-top">
        <td colSpan={5} className="py-3">
          <div className="max-w-xl">
            <ReclasificacionForm
              informeId={informeId}
              empresas={empresas}
              cuentasPorEmpresa={cuentasPorEmpresa}
              onDone={() => {
                setEditando(false);
                router.refresh();
              }}
              editar={{
                id,
                empresaId,
                detalle,
                lineas: lineas.map((l) => ({
                  planDeCuentaId: l.planDeCuentaId,
                  debe: l.debe,
                  haber: l.haber,
                })),
                cantidadAdjuntosExistentes: adjuntos.length,
              }}
            />
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-3">{new Date(createdAt).toLocaleString("es-AR")}</td>
      <td className="py-2 pr-3">{nombreEmpresa}</td>
      <td className="py-2 pr-3">{detalle}</td>
      <td className="py-2 pr-3">
        <ul className="text-xs">
          {lineas.map((l, i) => (
            <li key={i}>
              {l.planDeCuenta.cuenta}: Debe {l.debe} / Haber {l.haber}
            </li>
          ))}
        </ul>
        {adjuntos.length > 0 && (
          <ul className="mt-1 text-xs">
            {adjuntos.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/adjuntos/reclasificacion/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  📎 {a.nombreArchivo}
                </a>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-2 pr-3">
        {puedeEditar && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Editar
            </button>
            <ConfirmDeleteButton
              itemLabel="esta reclasificación"
              check={() => checkDeleteReclasificacion(id)}
              onConfirm={() => deleteReclasificacion(id)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}
