import Link from "next/link";

const GRUPOS = [
  {
    titulo: "General",
    links: [
      { href: "/configuracion/unidades-negocio", label: "Unidades de Negocio" },
      { href: "/configuracion/empresas", label: "Empresas" },
      { href: "/admin/users", label: "Usuarios" },
      { href: "/configuracion/series-e-indices", label: "Series e Índices" },
      { href: "/configuracion/monedas", label: "Monedas" },
    ],
  },
  {
    titulo: "Contabilidad",
    links: [
      { href: "/configuracion/partida-patrimonial", label: "Partida Patrimonial" },
      { href: "/configuracion/tipo-partida", label: "Tipo de Partida" },
      { href: "/configuracion/rubro", label: "Rubro" },
      { href: "/configuracion/subrubro", label: "Subrubro" },
      { href: "/configuracion/subrubro-2", label: "Subrubro 2" },
      { href: "/configuracion/subrubro-3", label: "Subrubro 3" },
      { href: "/configuracion/categoria-oya", label: "Categoría OyA" },
    ],
  },
];

export default function ConfiguracionPage() {
  return (
    <main className="flex w-full flex-col items-start gap-6 p-8">
      <h1 className="text-2xl font-semibold">Configuración</h1>

      <div className="flex flex-wrap items-start gap-6">
        {GRUPOS.map((grupo) => (
          <section
            key={grupo.titulo}
            className="flex flex-col items-start gap-3 rounded-md border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-medium text-slate-500">{grupo.titulo}</h2>
            <ul className="flex flex-col items-start gap-3">
              {grupo.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded-md text-lg text-slate-700 underline hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <Link
          href="/configuracion/plan-de-cuentas"
          className="flex flex-col items-start gap-3 rounded-md border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <h2 className="text-lg font-medium text-slate-500">Plan de Cuentas</h2>
          <span className="text-lg text-slate-700 underline">Entrar por Unidad de Negocio</span>
        </Link>
      </div>
    </main>
  );
}
