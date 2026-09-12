"use client";

import { openInWindow } from "@/lib/openWindow";

type EmpresaTile = {
  codEmp: number;
  nombreEmp: string;
  imagenMime: string | null;
};

export function EmpresaGrid({ empresas }: { empresas: EmpresaTile[] }) {
  if (empresas.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Todavía no hay empresas configuradas. Agregalas desde Opciones → Configuración.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {empresas.map((empresa) => (
        <button
          key={empresa.codEmp}
          onClick={() =>
            openInWindow(`/empresa/${empresa.codEmp}`, `empresa-${empresa.codEmp}`)
          }
          className="flex flex-col items-center gap-3 rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {empresa.imagenMime ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/empresas/${empresa.codEmp}/logo`}
              alt={empresa.nombreEmp}
              className="h-32 w-32 object-contain"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400">
              Sin logo
            </div>
          )}
          <span className="text-base font-medium">{empresa.nombreEmp}</span>
        </button>
      ))}
    </div>
  );
}
