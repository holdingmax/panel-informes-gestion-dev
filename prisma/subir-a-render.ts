import "dotenv/config";
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

// Carga en la base de Render DEV (RENDER_DATABASE_URL) los datos de la base
// local (DATABASE_URL) — o de un respaldo ya hecho. Es el paso inicial para
// que Render DEV tenga los mismos datos y usuarios que el entorno local; de ahí
// en adelante el camino es al revés (npm run db:sincronizar).
//
// Si Render DEV ya tiene datos, no hace nada salvo que se pase --reemplazar, y
// en ese caso respalda antes lo que tiene Render.
//
// Uso: npm run db:subir-a-render [-- --reemplazar] [-- --desde <carpeta-de-respaldo>]
//   --desde  usa ese respaldo en vez de hacer uno nuevo de la base local.

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const renderUrl = process.env.RENDER_DATABASE_URL;
  const localUrl = process.env.DATABASE_URL;
  if (!renderUrl) throw new Error("Falta RENDER_DATABASE_URL en el .env (la URL externa de la base de Render).");
  if (!localUrl) throw new Error("Falta DATABASE_URL en el .env.");
  if (mismaBase(renderUrl, localUrl)) throw new Error("RENDER_DATABASE_URL y DATABASE_URL apuntan a la misma base: no hay nada que subir.");

  const reemplazar = process.argv.includes("--reemplazar");
  const raiz = path.resolve(__dirname, "..");
  const respaldos = path.resolve(raiz, "..", "Respaldos");
  const fecha = fechaHoraCarpeta();

  console.log(`[subir] Origen:  ${argumento("--desde") ? path.resolve(argumento("--desde")!) : `${describirUrl(localUrl)} (base local)`}`);
  console.log(`[subir] Destino: ${describirUrl(renderUrl)} (Render DEV)`);

  // ---- Comprobaciones previas ----
  const render = clientePg(renderUrl);
  await render.connect();
  let tieneDatos = false;
  try {
    const migRender = await migracionesAplicadas(render);
    if (migRender.length === 0) {
      throw new Error("La base de Render DEV todavía no tiene el esquema. Corré primero: npm run db:migrar-render");
    }
    const r = await render.query<{ n: string }>(`SELECT count(*) AS n FROM "User"`);
    tieneDatos = Number(r.rows[0].n) > 0;
  } finally {
    await render.end().catch(() => undefined);
  }
  if (tieneDatos && !reemplazar) {
    throw new Error("La base de Render DEV ya tiene datos. Si querés reemplazarlos por los locales, repetí con: npm run db:subir-a-render -- --reemplazar");
  }

  // ---- Respaldo de lo que hay en Render (si hay) ----
  if (tieneDatos) {
    const carpeta = path.join(respaldos, `${fecha}_render-dev-antes-de-subir`, "base-de-datos");
    console.log("[subir] Respaldando lo que hay hoy en Render DEV antes de reemplazarlo…");
    await respaldarBase(renderUrl, carpeta);
    console.log(`        → ${carpeta}`);
  }

  // ---- Origen: respaldo nuevo de la base local, o el que se indique ----
  let carpetaOrigen = argumento("--desde");
  if (!carpetaOrigen) {
    carpetaOrigen = path.join(respaldos, `${fecha}_local-para-subir`, "base-de-datos");
    console.log("[subir] Respaldando la base local…");
    await respaldarBase(localUrl, carpetaOrigen);
    console.log(`        → ${carpetaOrigen}`);
  }

  console.log("[subir] Cargando los datos en Render DEV…");
  const cargadas = await restaurarDesdeCarpeta(renderUrl, path.resolve(carpetaOrigen), {
    reemplazar,
    alAvanzar: (m) => console.log(m),
  });
  console.log(`[subir] Listo: Render DEV tiene ahora ${Object.keys(cargadas).length} tablas y ${Object.values(cargadas).reduce((a, b) => a + b, 0)} filas, usuarios incluidos.`);
  return 0;
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e) => {
    console.error(`\n[subir] NO se subió nada: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  });
