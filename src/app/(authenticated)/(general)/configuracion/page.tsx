import Link from "next/link";

const LINKS = [
  { href: "/configuracion/empresas", label: "Empresas" },
  { href: "/configuracion/partida-patrimonial", label: "Partida Patrimonial" },
  { href: "/configuracion/rubro", label: "Rubro" },
  { href: "/configuracion/subrubro", label: "Subrubro" },
  { href: "/configuracion/subrubro-2", label: "Subrubro 2" },
  { href: "/configuracion/subrubro-3", label: "Subrubro 3" },
  { href: "/configuracion/categoria-oya", label: "Categoría OyA" },
  { href: "/configuracion/plan-de-cuentas", label: "Plan de Cuentas" },
];

export default function ConfiguracionPage() {
  return (
    <main className="flex w-full flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <ul className="flex flex-col items-start gap-3 rounded-lg bg-white p-6 shadow">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-lg underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
