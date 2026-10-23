import "dotenv/config";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  clientePg,
  describirUrl,
  fechaHoraCarpeta,
  migracionesAplicadas,
  mismaBase,
} from "./lib/conexion";
import { respaldarBase } from "./lib/respaldo";
import { restaurarDesdeCarpeta } from "./lib/restauracion";

// Al empezar a trabajar: trae a la base de desarrollo local (DATABASE_URL) lo
// que hay AHORA en la base de Render DEV (RENDER_DATABASE_URL), para que el
// entorno local arranque con los mismos datos y usuarios que Render.
//
//   1. Respalda la base de Render DEV (carpeta *_render-dev en Respaldos).
//   2. Respalda la base local ANTES de pisarla (carpeta *_local-antes-de-sincronizar),
//      así no se pierde nada de lo que hubiera hecho solo en local.
//   3. Reemplaza los datos locales por los de Render, en una sola transacción.
//
// No toca nada si algo no cierra: Render inaccesible, Render sin datos, o
// migraciones distintas entre las dos bases. En esos casos avisa y sale.
//
// Uso: npm run db:sincronizar        (o lo corre solo iniciar-panel.bat)
//      npm run db:sincronizar -- --solo-respaldo   (solo respalda Render, no pisa lo local)

const MANTENER_RESPALDOS_AUTOMATICOS = 10;
const SUFIJOS_AUTOMATICOS = ["_render-dev", "_local-antes-de-sincronizar"];

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const tiene = (nombre: string) => process.argv.includes(nombre);

// Los respaldos automáticos se acumulan con cada arranque: se conservan los
// últimos N de cada tipo y se borran los más viejos (solo carpetas con el
// nombre exacto que crea este script).
function limpiarRespaldosViejos(carpetaRespaldos: string) {
  if (!existsSync(carpetaRespaldos)) return;
  for (const sufijo of SUFIJOS_AUTOMATICOS) {
    const propias = readdirSync(carpetaRespaldos, { withFileTypes: true })
      .filter((d) => d.isDirectory() && new RegExp(`^\\d{4}-\\d{2}-\\d{2}_\\d{6}${sufijo}$`).test(d.name))
      .map((d) => d.name)
      .sort();
    for (const vieja of propias.slice(0, Math.max(0, propias.length - MANTENER_RESPALDOS_AUTOMATICOS))) {
      rmSync(path.join(carpetaRespaldos, vieja), { recursive: true, force: true });
    }
  }
}

async function main(): Promise<number> {
  const renderUrl = process.env.RENDER_DATABASE_URL;
  const localUrl = process.env.DATABASE_URL;

  if (!renderUrl) {
    console.log("[sincronizar] No hay RENDER_DATABASE_URL en el .env: se omite la sincronización con Render DEV.");
    return 0;
  }
  if (!localUrl) throw new Error("Falta DATABASE_URL en el .env.");
  if (mismaBase(renderUrl, localUrl) && !tiene("--ensayo")) {
    console.log("[sincronizar] La base local y la de Render DEV son la misma: no hay nada que sincronizar.");
    return 0;
  }

  const esquemaDestino = argumento("--esquema-destino");
  const raiz = path.resolve(__dirname, "..");
  const respaldos = path.resolve(raiz, "..", "Respaldos");
  const fecha = fechaHoraCarpeta();

  console.log(`[sincronizar] Render DEV: ${describirUrl(renderUrl)}`);
  console.log(`[sincronizar] Local:      ${describirUrl(localUrl)}${esquemaDestino ? ` (esquema ${esquemaDestino})` : ""}`);

  // ---- Comprobaciones previas (no se toca nada todavía) ----
  const render = clientePg(renderUrl);
  const local = clientePg(localUrl);
  try {
    await render.connect();
  } catch (e) {
    console.log(`[sincronizar] NO se pudo conectar a Render DEV (${e instanceof Error ? e.message : e}). Se sigue con la base local tal como está.`);
    return 1;
  }
  try {
    await local.connect();
    const migRender = await migracionesAplicadas(render);
    const migLocal = await migracionesAplicadas(local);
    if (migRender.length === 0) {
      console.log("[sincronizar] La base de Render DEV todavía no tiene el esquema (sin migraciones). Corré: npm run db:migrar-render, y después npm run db:subir-a-render.");
      return 1;
    }
    const distintas = [...new Set([...migRender, ...migLocal])].filter((m) => migRender.includes(m) !== migLocal.includes(m));
    if (distintas.length > 0) {
      console.log(
        `[sincronizar] NO se sincronizó: las migraciones no coinciden entre Render DEV y la base local (${distintas.join(", ")}). ` +
          "Desplegá en Render la misma versión del código que tenés acá (commit + push) y reintentá."
      );
      return 1;
    }
  } finally {
    await render.end().catch(() => undefined);
    await local.end().catch(() => undefined);
  }

  // ---- 1. Respaldo de Render DEV ----
  const carpetaRender = path.join(respaldos, `${fecha}_render-dev`, "base-de-datos");
  console.log("[sincronizar] 1/3 Respaldando la base de Render DEV…");
  const resumenRender = await respaldarBase(renderUrl, carpetaRender);
  const filasRender = Object.values(resumenRender.tablas).reduce((a, b) => a + b, 0);
  console.log(`              ${Object.keys(resumenRender.tablas).length} tablas, ${filasRender} filas → ${carpetaRender}`);
  if ((resumenRender.tablas.user ?? 0) === 0) {
    console.log("[sincronizar] NO se sincronizó: la base de Render DEV no tiene ningún usuario (parece vacía) y pisaría la local. Cargala primero: npm run db:subir-a-render.");
    return 1;
  }
  if (tiene("--solo-respaldo")) {
    console.log("[sincronizar] Listo (solo respaldo): la base local no se tocó.");
    return 0;
  }

  // ---- 2. Respaldo de la base local, antes de pisarla ----
  const carpetaLocal = path.join(respaldos, `${fecha}_local-antes-de-sincronizar`, "base-de-datos");
  console.log("[sincronizar] 2/3 Respaldando la base local antes de reemplazarla…");
  const resumenLocal = await respaldarBase(localUrl, carpetaLocal);
  console.log(`              ${Object.values(resumenLocal.tablas).reduce((a, b) => a + b, 0)} filas → ${carpetaLocal}`);

  // ---- 3. Reemplazo de la base local por la de Render ----
  console.log("[sincronizar] 3/3 Cargando en la base local los datos de Render DEV…");
  const cargadas = await restaurarDesdeCarpeta(localUrl, carpetaRender, {
    reemplazar: true,
    esquema: esquemaDestino,
    alAvanzar: (m) => console.log(m),
  });

  limpiarRespaldosViejos(respaldos);
  console.log(
    `[sincronizar] Listo: la base local ahora es una copia de Render DEV (${Object.keys(cargadas).length} tablas, ${Object.values(cargadas).reduce((a, b) => a + b, 0)} filas).`
  );
  console.log(`[sincronizar] Lo que había en local quedó respaldado en: ${path.dirname(carpetaLocal)}`);
  return 0;
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e) => {
    console.error(`\n[sincronizar] FALLÓ: ${e instanceof Error ? e.message : e}`);
    console.error("[sincronizar] La base local no se modificó (la carga es transaccional).");
    process.exitCode = 1;
  });
