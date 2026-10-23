import "dotenv/config";
import { execSync } from "node:child_process";
import path from "node:path";
import { describirUrl, esDeRender } from "./lib/conexion";

// Aplica las migraciones de Prisma (prisma migrate deploy) a la base de Render
// DEV (RENDER_DATABASE_URL), sin tocar la base local. Crea el esquema si la
// base está vacía. Render también lo hace en cada despliegue; esto sirve para
// dejarla lista antes de cargarle los datos (npm run db:subir-a-render).
//
// Uso: npm run db:migrar-render

const url = process.env.RENDER_DATABASE_URL;
if (!url) {
  console.error("Falta RENDER_DATABASE_URL en el .env (la URL externa de la base de Render).");
  process.exit(1);
}

// El acceso externo a Render exige SSL.
const destino = new URL(url);
if (esDeRender(url) && !destino.searchParams.has("sslmode")) destino.searchParams.set("sslmode", "require");

console.log(`Aplicando migraciones en ${describirUrl(url)} (Render DEV)…`);
try {
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    // prisma.config.ts lee DATABASE_URL: para este comando apunta a Render.
    env: { ...process.env, DATABASE_URL: destino.toString() },
  });
} catch {
  process.exit(1);
}
