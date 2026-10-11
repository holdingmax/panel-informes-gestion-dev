"use client";

import { useActionState, useRef, useState } from "react";
import { createReclasificacion, updateReclasificacion } from "@/lib/reclasificacion-actions";

type CuentaOpcion = { id: string; cuenta: string };
type Fila = { planDeCuentaId: string; debe: string; haber: string };
type SaldoAfectado = "FINAL" | "INICIAL";

function filaVacia(): Fila {
  return { planDeCuentaId: "", debe: "", haber: "" };
}

export function ReclasificacionForm({
  informeId,
  empresas,
  cuentasPorEmpresa,
  onDone,
  editar,
}: {
  informeId: string;
  empresas: { codEmp: number; nombreEmp: string }[];
  cuentasPorEmpresa: Record<number, CuentaOpcion[]>;
  onDone?: () => void;
  // Si se pasa, el formulario edita esa reclasificación en vez de crear una
  // nueva — la Empresa queda fija (no se puede migrar a otra empresa).
  editar?: {
    id: string;
    empresaId: number;
    detalle: string;
    saldoAfectado: SaldoAfectado;
    lineas: Fila[];
    cantidadAdjuntosExistentes: number;
  };
}) {
  const [empresaId, setEmpresaId] = useState(editar?.empresaId ?? empresas[0]?.codEmp ?? 0);
  const [filas, setFilas] = useState<Fila[]>(editar?.lineas ?? [filaVacia(), filaVacia()]);
  // Siempre arranca en "Saldo Final" al cargar una nueva; al editar, en el
  // valor que ya tenía.
  const [saldoAfectado, setSaldoAfectado] = useState<SaldoAfectado>(editar?.saldoAfectado ?? "FINAL");
  const [confirmandoInicial, setConfirmandoInicial] = useState(false);
  const inicialConfirmadoRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<{ error?: string } | null, FormData>(
    async (_prev, formData) => {
      try {
        if (editar) {
          await updateReclasificacion(editar.id, formData);
        } else {
          await createReclasificacion(informeId, empresaId, formData);
          setFilas([filaVacia(), filaVacia()]);
          setSaldoAfectado("FINAL");
        }
        onDone?.();
        return null;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error al guardar." };
      }
    },
    null
  );

  const totalDebe = filas.reduce((a, f) => a + (Number(f.debe) || 0), 0);
  const totalHaber = filas.reduce((a, f) => a + (Number(f.haber) || 0), 0);
  const balanceado = Math.abs(totalDebe - totalHaber) < 0.01 && totalDebe > 0;
  const cuentas = cuentasPorEmpresa[empresaId] ?? [];
  const nombreEmpresa = empresas.find((e) => e.codEmp === empresaId)?.nombreEmp ?? "";

  function actualizarFila(i: number, campo: keyof Fila, valor: string) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  // Con "Saldo Inicial" el guardado se frena hasta que el usuario confirma en
  // el cartel de advertencia; "Cancelar" lo deja en esta misma ventana.
  function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    if (saldoAfectado === "INICIAL" && !inicialConfirmadoRef.current) {
      e.preventDefault();
      setConfirmandoInicial(true);
      return;
    }
    inicialConfirmadoRef.current = false;
  }

  function confirmarInicial() {
    inicialConfirmadoRef.current = true;
    setConfirmandoInicial(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={alEnviar} className="flex flex-col gap-4">
      {editar || empresas.length <= 1 ? (
        <p className="text-sm">
          <span className="font-medium">Empresa:</span> {nombreEmpresa}
        </p>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-sm">Empresa</span>
          <select
            value={empresaId}
            onChange={(e) => {
              setEmpresaId(Number(e.target.value));
              setFilas([filaVacia(), filaVacia()]);
            }}
            className="w-fit rounded border px-3 py-2 text-sm"
          >
            {empresas.map((e) => (
              <option key={e.codEmp} value={e.codEmp}>
                {e.nombreEmp}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm">Saldo de reclasifica</span>
        <select
          name="saldoAfectado"
          value={saldoAfectado}
          onChange={(e) => setSaldoAfectado(e.target.value === "INICIAL" ? "INICIAL" : "FINAL")}
          className="w-fit rounded border px-3 py-2 text-sm"
        >
          <option value="FINAL">Saldo Final</option>
          <option value="INICIAL">Saldo Inicial</option>
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_110px_110px_auto] gap-2 text-xs font-medium text-zinc-600">
          <span>Cuenta</span>
          <span>Debe</span>
          <span>Haber</span>
          <span />
        </div>
        {filas.map((fila, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_110px_auto] gap-2">
            <select
              name="lineaPlanDeCuentaId"
              required
              value={fila.planDeCuentaId}
              onChange={(e) => actualizarFila(i, "planDeCuentaId", e.target.value)}
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="">Seleccionar...</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cuenta}
                </option>
              ))}
            </select>
            <input
              name="lineaDebe"
              type="number"
              step="0.01"
              min="0"
              value={fila.debe}
              onChange={(e) => actualizarFila(i, "debe", e.target.value)}
              className="rounded border px-2 py-1.5 text-sm"
            />
            <input
              name="lineaHaber"
              type="number"
              step="0.01"
              min="0"
              value={fila.haber}
              onChange={(e) => actualizarFila(i, "haber", e.target.value)}
              className="rounded border px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={filas.length <= 2}
              onClick={() => setFilas((prev) => prev.filter((_, idx) => idx !== i))}
              className="rounded border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFilas((prev) => [...prev, filaVacia()])}
          className="w-fit rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          + Agregar línea
        </button>
        <p className={`text-sm ${balanceado ? "text-emerald-700" : "text-red-600"}`}>
          Debe: {totalDebe.toFixed(2)} — Haber: {totalHaber.toFixed(2)}
          {!balanceado && " — tienen que ser iguales para poder guardar"}
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm">Detalle (motivo)</span>
        <textarea
          name="detalle"
          required
          maxLength={500}
          rows={3}
          defaultValue={editar?.detalle ?? ""}
          className="rounded border px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">
          Adjuntos (hasta 3 — imagen, PDF, Word o Excel, 10MB c/u)
          {editar && editar.cantidadAdjuntosExistentes > 0 && (
            <span className="text-zinc-500">
              {" "}
              — ya tiene {editar.cantidadAdjuntosExistentes}, estos se suman
            </span>
          )}
        </span>
        <input
          name="adjuntos"
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="rounded border px-3 py-2 text-sm"
        />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || !balanceado}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Guardando..." : editar ? "GUARDAR CAMBIOS" : "GUARDAR"}
      </button>

      {confirmandoInicial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <p className="text-lg font-medium">Reclasificación sobre Saldo Inicial</p>
            <p className="mt-2 text-sm text-zinc-600">
              Esta reclasificación afectará únicamente a los saldos iniciales de los informes. El
              saldo final no se modifica. ¿Querés guardarla igual?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmandoInicial(false)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarInicial}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
