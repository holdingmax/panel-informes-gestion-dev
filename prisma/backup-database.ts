import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

// Respaldo completo de la base: exporta cada tabla a un JSON aparte dentro
// de la carpeta que se le pase como argumento. No requiere pg_dump (no
// disponible en este entorno) — usa el propio Prisma Client, así que
// serializa a mano los tipos que JSON no soporta nativamente (Decimal,
// Bytes).
const MODELOS = [
  "user",
  "unidadNegocio",
  "empresa",
  "moneda",
  "informe",
  "balanceSumasYSaldos",
  "tipoPartida",
  "partidaPatrimonial",
  "rubro",
  "subrubro",
  "subrubro2",
  "subrubro3",
  "categoriaOyA",
  "seriesEIndicesTabla",
  "seriesEIndices",
  "resultadosHistoricos",
  "planDeCuentas",
] as const;

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

  writeFileSync(
    path.join(outDir, "_resumen.json"),
    JSON.stringify({ fecha: new Date().toISOString(), tablas: resumen }, null, 2),
    "utf-8"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
