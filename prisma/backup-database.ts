import "dotenv/config";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";

// Respaldo completo de la base: exporta cada tabla a un JSON aparte dentro
// de la carpeta que se le pase como argumento. No requiere pg_dump (no
// disponible en este entorno) — usa el propio Prisma Client, así que
// serializa a mano los tipos que JSON no soporta nativamente (Decimal,
// Bytes).
//
// Las tablas se toman del propio cliente de Prisma (Prisma.ModelName), no de
// una lista escrita a mano: cualquier tabla nueva que se agregue al schema
// entra sola al respaldo, y una que se elimine no lo rompe.
const MODELOS = Object.values(Prisma.ModelName).map((nombre) => nombre.charAt(0).toLowerCase() + nombre.slice(1));

function serializar(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString("base64") };
  if (typeof value === "object" && value !== null && "toFixed" in value && "toString" in value) {
    // Prisma.Decimal
    return { $decimal: value.toString() };
  }
  return value;
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error("Uso: tsx backup-database.ts <carpeta-destino>");
  mkdirSync(outDir, { recursive: true });

  const resumen: Record<string, number> = {};

  for (const modelo of MODELOS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filas = await (prisma as any)[modelo].findMany();
    writeFileSync(path.join(outDir, `${modelo}.json`), JSON.stringify(filas, serializar, 2), "utf-8");
    resumen[modelo] = filas.length;
    console.log(`${modelo}: ${filas.length} fila(s)`);
  }

  // Migraciones aplicadas al momento del respaldo: la base donde se restaure
  // tiene que tener al menos estas.
  const migraciones = await prisma
    .$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY started_at, migration_name`
    .then((filas) => filas.map((m) => m.migration_name))
    .catch(() => [] as string[]);

  // Copia del schema de ese momento, para saber exactamente qué columnas tiene cada JSON.
  copyFileSync(path.resolve(__dirname, "schema.prisma"), path.join(outDir, "schema.prisma.snapshot"));

  writeFileSync(
    path.join(outDir, "_resumen.json"),
    JSON.stringify({ fecha: new Date().toISOString(), migraciones, tablas: resumen }, null, 2),
    "utf-8"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
