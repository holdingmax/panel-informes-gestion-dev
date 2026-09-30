// Respaldo completo con un solo comando — pensado para correr después de
// cualquier cambio hecho directamente en Render (la app de Render y este
// proyecto local usan la MISMA base Prisma Postgres, así que cualquier
// cambio hecho ahí ya está en esta base: respaldarla acá alcanza).
//
// Uso: npx tsx prisma/respaldar-todo.ts
// (o doble clic en respaldar.bat, en la raíz del proyecto)
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

function fechaHoraCarpeta(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function main() {
  const projectDir = path.resolve(__dirname, "..");
  // "Respaldos" es hermana de la carpeta del proyecto, no está adentro —
  // mismo lugar que ya se usó a mano en sesiones anteriores.
  const respaldosDir = path.resolve(projectDir, "..", "Respaldos");
  const destino = path.join(respaldosDir, `${fechaHoraCarpeta()}-render`);

  const repoDir = path.join(destino, "repositorio");
  const dbDir = path.join(destino, "base-de-datos");
  mkdirSync(repoDir, { recursive: true });
  mkdirSync(dbDir, { recursive: true });

  console.log(`Respaldando en: ${destino}\n`);

  console.log("1/2 — Historial de git...");
  execSync(`git bundle create "${path.join(repoDir, "repo-github-backup.bundle")}" --all`, {
    cwd: projectDir,
    stdio: "inherit",
  });

  console.log("\n2/2 — Base de datos...");
  execSync(`npx tsx prisma/backup-database.ts "${dbDir}"`, {
    cwd: projectDir,
    stdio: "inherit",
  });

  console.log(`\nListo. Respaldo completo en:\n${destino}`);
}

main();
