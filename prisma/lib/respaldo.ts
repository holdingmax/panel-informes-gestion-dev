import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { opcionesPg } from "./conexion";

// Respaldo completo de una base: un JSON por tabla (Decimal como {$decimal},
// Bytes como {$bytes} en base64), más _resumen.json y una copia del schema.
// Las tablas se toman del propio cliente de Prisma (Prisma.ModelName), no de
// una lista escrita a mano: cualquier tabla nueva entra sola al respaldo.
const MODELOS = Object.values(Prisma.ModelName).map((nombre) => nombre.charAt(0).toLowerCase() + nombre.slice(1));

function serializar(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString("base64") };
  if (typeof value === "object" && value !== null && "toFixed" in value && "toString" in value) {
    // Prisma.Decimal
    return { $decimal: value.toString() };
  }
  return value;
}

export type ResumenRespaldo = {
  fecha: string;
  migraciones: string[];
  tablas: Record<string, number>;
};

export async function respaldarBase(
  url: string,
  carpeta: string,
  alAvanzar?: (tabla: string, filas: number) => void
): Promise<ResumenRespaldo> {
  mkdirSync(carpeta, { recursive: true });
  // Cliente propio para esta URL (no el singleton de la app, que apunta a DATABASE_URL).
  const prisma = new PrismaClient({ adapter: new PrismaPg(opcionesPg(url)) });
  try {
    const tablas: Record<string, number> = {};
    for (const modelo of MODELOS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filas = await (prisma as any)[modelo].findMany();
      writeFileSync(path.join(carpeta, `${modelo}.json`), JSON.stringify(filas, serializar, 2), "utf-8");
      tablas[modelo] = filas.length;
      alAvanzar?.(modelo, filas.length);
    }

    // Migraciones aplicadas al momento del respaldo: la base donde se restaure
    // tiene que tener exactamente estas.
    const migraciones = await prisma
      .$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`
      .then((filas) => filas.map((m) => m.migration_name))
      .catch(() => [] as string[]);

    // Copia del schema de ese momento, para saber exactamente qué columnas tiene cada JSON.
    copyFileSync(path.resolve(__dirname, "..", "schema.prisma"), path.join(carpeta, "schema.prisma.snapshot"));

    const resumen: ResumenRespaldo = { fecha: new Date().toISOString(), migraciones, tablas };
    writeFileSync(path.join(carpeta, "_resumen.json"), JSON.stringify(resumen, null, 2), "utf-8");
    return resumen;
  } finally {
    await prisma.$disconnect();
  }
}
