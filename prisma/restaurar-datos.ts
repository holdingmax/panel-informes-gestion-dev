import "dotenv/config";
import path from "node:path";
import { describirUrl } from "./lib/conexion";
import { restaurarDesdeCarpeta } from "./lib/restauracion";

// Carga un respaldo (carpeta con un JSON por tabla, hecha con backup-database.ts)
// en una base de datos. Todo en una transacción: o se carga completo o no se
// toca nada.
//
// Uso: npx tsx prisma/restaurar-datos.ts <carpeta-respaldo> --destino <render|local|URL> [--reemplazar]
//   --destino render   → RENDER_DATABASE_URL del .env
//   --destino local    → DATABASE_URL del .env
//   --reemplazar       → borra antes los datos que tenga el destino (sin esto,
//                        si el destino tiene datos, no hace nada)
// El destino tiene que tener ya el esquema con las mismas migraciones.

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const carpeta = process.argv[2];
  const destino = argumento("--destino");
  if (!carpeta || carpeta.startsWith("--") || !destino) {
    throw new Error("Uso: npx tsx prisma/restaurar-datos.ts <carpeta-respaldo> --destino <render|local|URL> [--reemplazar]");
  }
  const url =
    destino === "render" ? process.env.RENDER_DATABASE_URL : destino === "local" ? process.env.DATABASE_URL : destino;
  if (!url) throw new Error(`No hay conexión para "${destino}": falta la variable en el .env.`);

  console.log(`Restaurando ${path.resolve(carpeta)}\n  en ${describirUrl(url)}${process.argv.includes("--reemplazar") ? " (reemplazando lo que haya)" : ""}`);
  const cargadas = await restaurarDesdeCarpeta(url, path.resolve(carpeta), {
    reemplazar: process.argv.includes("--reemplazar"),
    esquema: argumento("--esquema"),
    alAvanzar: (m) => console.log(m),
  });
  console.log(`\nListo: ${Object.keys(cargadas).length} tablas, ${Object.values(cargadas).reduce((a, b) => a + b, 0)} filas.`);
}

main().catch((e) => {
  console.error(`\nNO se restauró nada: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
