import pg from "pg";

// Utilidades de conexión para los scripts de respaldo / restauración /
// sincronización con Render DEV. Nunca imprimen usuario ni contraseña.

export function esDeRender(url: string): boolean {
  return new URL(url).hostname.endsWith(".render.com");
}

// Opciones del driver pg para una URL. Render exige SSL en las conexiones
// externas; se cifra la conexión sin validar la cadena de certificados (lo
// habitual para el acceso externo a una base de desarrollo en Render). Para
// eso se quita el sslmode de la URL, que si está pisa a estas opciones. Con
// cualquier otro proveedor (ej. Prisma Postgres) la URL se usa tal cual.
export function opcionesPg(url: string): pg.ClientConfig {
  if (!esDeRender(url)) return { connectionString: url, connectionTimeoutMillis: 20_000 };
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  return {
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  };
}

export function clientePg(url: string): pg.Client {
  return new pg.Client(opcionesPg(url));
}

// "host:puerto/base" — para mostrar y para comparar bases sin exponer credenciales.
export function describirUrl(url: string): string {
  const u = new URL(url);
  return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
}

export function mismaBase(a: string, b: string): boolean {
  return describirUrl(a) === describirUrl(b);
}

export const TABLA_DE_MIGRACIONES = "_prisma_migrations";

export async function migracionesAplicadas(client: pg.Client, esquema = "public"): Promise<string[]> {
  const r = await client
    .query<{ migration_name: string }>(
      `SELECT migration_name FROM "${esquema}"."${TABLA_DE_MIGRACIONES}" WHERE finished_at IS NOT NULL ORDER BY migration_name`
    )
    .catch(() => null);
  return r ? r.rows.map((m) => m.migration_name) : [];
}

export function fechaHoraCarpeta(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
