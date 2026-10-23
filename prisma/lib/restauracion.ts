import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { clientePg, migracionesAplicadas, TABLA_DE_MIGRACIONES } from "./conexion";
import type { ResumenRespaldo } from "./respaldo";

// Carga en una base un respaldo hecho con respaldarBase (un JSON por tabla).
// Todo ocurre en UNA transacción: si algo falla (o los conteos finales no
// coinciden con el respaldo) no queda nada a medias.
//
// Requisitos del destino: tener ya el esquema (prisma migrate deploy) con
// EXACTAMENTE las mismas migraciones que el respaldo. Si tiene datos, hay que
// pedir `reemplazar` explícitamente (los borra antes de cargar).

const comillas = (nombre: string) => `"${nombre.replace(/"/g, '""')}"`;
const nombreDeTabla = (clave: string) => clave.charAt(0).toUpperCase() + clave.slice(1);
const MAX_PARAMETROS = 30_000;
const MAX_BYTES_POR_LOTE = 8_000_000;

export type OpcionesRestauracion = {
  // Esquema de PostgreSQL de destino (por defecto "public"; otro solo para ensayos).
  esquema?: string;
  // Borrar antes lo que haya en las tablas del destino.
  reemplazar?: boolean;
  alAvanzar?: (mensaje: string) => void;
};

function convertir(valor: unknown, tipoColumna: string): unknown {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "object" && valor !== null && "$bytes" in valor) {
    return Buffer.from(String((valor as { $bytes: string }).$bytes), "base64");
  }
  if (typeof valor === "object" && valor !== null && "$decimal" in valor) {
    return String((valor as { $decimal: string }).$decimal);
  }
  if (tipoColumna === "jsonb" || tipoColumna === "json") return JSON.stringify(valor);
  return valor;
}

// Las tablas "hijas" se cargan después de las "padres" para respetar las claves foráneas.
function ordenarPorDependencias(tablas: string[], dependencias: [string, string][]): string[] {
  const pendientes = new Map(tablas.map((t) => [t, new Set<string>()]));
  for (const [hijo, padre] of dependencias) {
    if (hijo !== padre && pendientes.has(hijo) && pendientes.has(padre)) pendientes.get(hijo)!.add(padre);
  }
  const orden: string[] = [];
  while (pendientes.size > 0) {
    const listas = [...pendientes].filter(([, deps]) => deps.size === 0).map(([t]) => t).sort();
    if (listas.length === 0) {
      orden.push(...[...pendientes.keys()].sort());
      break;
    }
    for (const t of listas) {
      orden.push(t);
      pendientes.delete(t);
      for (const deps of pendientes.values()) deps.delete(t);
    }
  }
  return orden;
}

export async function restaurarDesdeCarpeta(
  url: string,
  carpeta: string,
  opciones: OpcionesRestauracion = {}
): Promise<Record<string, number>> {
  const esquema = opciones.esquema ?? "public";
  const log = opciones.alAvanzar ?? (() => undefined);

  const rutaResumen = path.join(carpeta, "_resumen.json");
  if (!existsSync(rutaResumen)) throw new Error(`No es una carpeta de respaldo: falta _resumen.json en ${carpeta}`);
  const resumen = JSON.parse(readFileSync(rutaResumen, "utf-8")) as ResumenRespaldo;
  const claves = Object.keys(resumen.tablas);

  const client = clientePg(url);
  await client.connect();
  try {
    // ---- El destino tiene que tener el mismo esquema ----
    const tablasDestino = (
      await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE' AND table_name <> $2`,
        [esquema, TABLA_DE_MIGRACIONES]
      )
    ).rows.map((r) => r.table_name);
    const tablasRespaldo = claves.map(nombreDeTabla);
    const faltan = tablasRespaldo.filter((t) => !tablasDestino.includes(t));
    const sobran = tablasDestino.filter((t) => !tablasRespaldo.includes(t));
    if (faltan.length > 0 || sobran.length > 0) {
      throw new Error(
        `El esquema del destino no coincide con el respaldo. ` +
          (faltan.length ? `Faltan tablas en el destino: ${faltan.join(", ")}. ` : "") +
          (sobran.length ? `El destino tiene tablas que el respaldo no: ${sobran.join(", ")}. ` : "") +
          `Aplicá las migraciones en el destino (prisma migrate deploy) y reintentá.`
      );
    }

    if (resumen.migraciones && resumen.migraciones.length > 0) {
      const enDestino = await migracionesAplicadas(client, "public");
      const faltanMig = resumen.migraciones.filter((m) => !enDestino.includes(m));
      const extraMig = enDestino.filter((m) => !resumen.migraciones.includes(m));
      if (faltanMig.length > 0 || extraMig.length > 0) {
        throw new Error(
          `Las migraciones del destino no coinciden con las del respaldo. ` +
            (faltanMig.length ? `Le faltan al destino: ${faltanMig.join(", ")}. ` : "") +
            (extraMig.length ? `El destino tiene de más: ${extraMig.join(", ")}. ` : "") +
            `Desplegá la misma versión del código (o corré prisma migrate deploy) y reintentá.`
        );
      }
    } else {
      log("Aviso: el respaldo no registra sus migraciones; no se pudo comprobar que el esquema coincida.");
    }

    // ---- Qué hay hoy en el destino ----
    const existentes: Record<string, number> = {};
    for (const t of tablasDestino) {
      const r = await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${comillas(esquema)}.${comillas(t)}`);
      existentes[t] = Number(r.rows[0].n);
    }
    const conDatos = Object.entries(existentes).filter(([, n]) => n > 0);
    if (conDatos.length > 0 && !opciones.reemplazar) {
      throw new Error(
        `El destino ya tiene datos (${conDatos.map(([t, n]) => `${t}: ${n}`).join(", ")}). ` +
          `Para reemplazarlos por los del respaldo, usá la opción de reemplazar.`
      );
    }

    // ---- Orden de carga según las claves foráneas ----
    const fks = await client.query<{ hijo: string; padre: string }>(
      `SELECT ch.relname AS hijo, cp.relname AS padre
       FROM pg_constraint c
       JOIN pg_class ch ON ch.oid = c.conrelid
       JOIN pg_class cp ON cp.oid = c.confrelid
       JOIN pg_namespace n ON n.oid = ch.relnamespace
       WHERE c.contype = 'f' AND n.nspname = $1`,
      [esquema]
    );
    const orden = ordenarPorDependencias(
      tablasRespaldo,
      fks.rows.map((f) => [f.hijo, f.padre] as [string, string])
    );

    // ---- Carga, todo en una transacción ----
    await client.query("BEGIN");
    try {
      if (opciones.reemplazar && conDatos.length > 0) {
        log("Borrando los datos actuales del destino…");
        await client.query(
          `TRUNCATE ${tablasRespaldo.map((t) => `${comillas(esquema)}.${comillas(t)}`).join(", ")} RESTART IDENTITY CASCADE`
        );
      }

      const cargadas: Record<string, number> = {};
      for (const tabla of orden) {
        const clave = claves.find((c) => nombreDeTabla(c) === tabla)!;
        const rutaTabla = path.join(carpeta, `${clave}.json`);
        if (!existsSync(rutaTabla)) throw new Error(`Falta el archivo ${clave}.json en el respaldo.`);
        const filas = JSON.parse(readFileSync(rutaTabla, "utf-8")) as Record<string, unknown>[];
        const destino = `${comillas(esquema)}.${comillas(tabla)}`;
        cargadas[clave] = filas.length;
        if (filas.length === 0) continue;

        const columnas = await client.query<{ column_name: string; udt_name: string; column_default: string | null }>(
          `SELECT column_name, udt_name, column_default FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2`,
          [esquema, tabla]
        );
        const tipos = new Map(columnas.rows.map((c) => [c.column_name, c.udt_name]));
        const nombres = Object.keys(filas[0]);
        const desconocidas = nombres.filter((n) => !tipos.has(n));
        if (desconocidas.length > 0) {
          throw new Error(`${tabla}: el respaldo trae columnas que el destino no tiene: ${desconocidas.join(", ")}.`);
        }

        const porLote = Math.max(1, Math.floor(MAX_PARAMETROS / nombres.length));
        let lote: Record<string, unknown>[] = [];
        let bytes = 0;
        const insertar = async () => {
          if (lote.length === 0) return;
          const parametros: unknown[] = [];
          const grupos = lote.map((fila) => {
            const marcadores = nombres.map((n) => {
              parametros.push(convertir(fila[n], tipos.get(n)!));
              return `$${parametros.length}`;
            });
            return `(${marcadores.join(", ")})`;
          });
          await client.query(
            `INSERT INTO ${destino} (${nombres.map(comillas).join(", ")}) VALUES ${grupos.join(", ")}`,
            parametros
          );
          lote = [];
          bytes = 0;
        };
        for (const fila of filas) {
          lote.push(fila);
          bytes += JSON.stringify(fila).length;
          if (lote.length >= porLote || bytes > MAX_BYTES_POR_LOTE) await insertar();
        }
        await insertar();

        // Las tablas con id autoincremental siguen desde el mayor id cargado.
        for (const col of columnas.rows.filter((c) => c.column_default?.startsWith("nextval("))) {
          await client.query(
            `SELECT setval(pg_get_serial_sequence($1, $2),
                     COALESCE((SELECT MAX(${comillas(col.column_name)}) FROM ${destino}), 1),
                     (SELECT MAX(${comillas(col.column_name)}) FROM ${destino}) IS NOT NULL)`,
            [destino, col.column_name]
          );
        }
        log(`  ${tabla}: ${filas.length} fila(s)`);
      }

      // ---- Verificación: lo cargado tiene que coincidir con el respaldo ----
      for (const clave of claves) {
        const tabla = nombreDeTabla(clave);
        const r = await client.query<{ n: string }>(`SELECT count(*) AS n FROM ${comillas(esquema)}.${comillas(tabla)}`);
        if (Number(r.rows[0].n) !== resumen.tablas[clave]) {
          throw new Error(`${tabla}: quedaron ${r.rows[0].n} fila(s) y el respaldo tiene ${resumen.tablas[clave]}.`);
        }
      }
      await client.query("COMMIT");
      return cargadas;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    }
  } finally {
    await client.end();
  }
}
