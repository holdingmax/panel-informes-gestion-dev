import "dotenv/config";
import { respaldarBase } from "./lib/respaldo";

// Respaldo completo de la base de DATABASE_URL: un JSON por tabla dentro de la
// carpeta que se le pase como argumento (ver prisma/lib/respaldo.ts). No
// requiere pg_dump (no disponible en este entorno).
//
// Uso: npx tsx prisma/backup-database.ts <carpeta-destino>

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error("Uso: tsx backup-database.ts <carpeta-destino>");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL en .env");

  await respaldarBase(url, outDir, (tabla, filas) => console.log(`${tabla}: ${filas} fila(s)`));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
