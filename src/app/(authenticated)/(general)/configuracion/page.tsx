import Link from "next/link";

const LINKS = [
  { href: "/configuracion/unidades-negocio", label: "Unidades de Negocio" },
  { href: "/configuracion/empresas", label: "Empresas" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/configuracion/partida-patrimonial", label: "Partida Patrimonial" },
  { href: "/configuracion/rubro", label: "Rubro" },
  { href: "/configuracion/subrubro", label: "Subrubro" },
  { href: "/configuracion/subrubro-2", label: "Subrubro 2" },
  { href: "/configuracion/subrubro-3", label: "Subrubro 3" },
  { href: "/configuracion/categoria-oya", label: "Categoría OyA" },
  { href: "/configuracion/plan-de-cuentas", label: "Plan de Cuentas" },
  { href: "/configuracion/series-e-indices", label: "Series e Índices" },
];

export default function ConfiguracionPage() {
  return (
    <main className="flex w-full flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <ul className="flex flex-col items-start gap-3 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        {LINKS.map((link) => (
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
    </main>
  );
}
