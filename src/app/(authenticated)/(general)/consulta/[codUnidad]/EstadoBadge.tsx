const ESTADO_INFO: Record<string, { label: string; className: string }> = {
  PROCESO: { label: "Proceso", className: "bg-blue-100 text-blue-800" },
  EN_REVISION: { label: "En revisión", className: "bg-yellow-100 text-yellow-800" },
  APROBADO: { label: "Aprobado", className: "bg-green-100 text-green-800" },
};

export function EstadoBadge({ estado }: { estado: string }) {
  const info = ESTADO_INFO[estado] ?? { label: estado, className: "bg-zinc-100 text-zinc-700" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}
