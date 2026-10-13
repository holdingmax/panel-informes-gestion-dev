"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccesoUnidad } from "@/lib/authz";
import { leerFilasCarga } from "@/lib/plan-de-cuentas-excel";
import {
  analizarFilas,
  codigoNumerico,
  type Conflicto,
  type Resolucion,
} from "@/lib/plan-de-cuentas-carga-masiva-core";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ERRORES_EN_RESPUESTA = 200;

export type RespuestaCargaMasiva =
  | { tipo: "error"; mensaje: string }
  // Carga inicial con valores que no están en las tablas de referencia: el
  // operador tiene que elegir cómo resolverlos antes de cargar.
  | { tipo: "conflictos"; conflictos: Conflicto[] }
  | {
      tipo: "resultado";
      totalFilas: number;
      cargadas: number;
      descartadasExistentes: number;
      ejemplosExistentes: string[];
      errores: { fila: number; cuenta: string; motivo: string }[];
      erroresOmitidos: number;
    };

function leerResoluciones(formData: FormData): Record<string, Resolucion> {
  const raw = formData.get("resoluciones");
  if (typeof raw !== "string" || raw === "") return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Resolucion>;
    const limpio: Record<string, Resolucion> = {};
    for (const [clave, r] of Object.entries(parsed)) {
      if (r?.accion === "vaciar") limpio[clave] = { accion: "vaciar" };
      else if (r?.accion === "usar" && typeof r.valor === "string") limpio[clave] = r;
    }
    return limpio;
  } catch {
    return {};
  }
}

// Carga masiva del Plan de Cuentas de las Empresas de una Unidad. Solo agrega
// las cuentas que todavía no existen (el criterio es la secuencia numérica del
// comienzo del nombre, dentro de cada Empresa); las que ya existen se descartan
// y se informan — para cambiarlas se usa Editar/Eliminar. Devuelve el
// resultado (no lanza) para que el mensaje llegue a la pantalla.
export async function cargaMasivaPlanDeCuentas(formData: FormData): Promise<RespuestaCargaMasiva> {
  const codUnidad = Number(formData.get("codUnidad"));
  if (!Number.isInteger(codUnidad)) return { tipo: "error", mensaje: "Unidad inválida." };
  await requireAccesoUnidad(codUnidad, "configuracion");

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { tipo: "error", mensaje: "Seleccioná un archivo Excel." };
  }
  if (archivo.size > MAX_BYTES) {
    return { tipo: "error", mensaje: "El archivo supera los 10 MB." };
  }

  const lectura = await leerFilasCarga(await archivo.arrayBuffer());
  if ("error" in lectura) return { tipo: "error", mensaje: lectura.error };
  if (lectura.filas.every((f) => f.cuenta === "" && f.empresa === "")) {
    return { tipo: "error", mensaje: "El archivo no tiene cuentas para cargar." };
  }

  const [empresasDb, partidas, rubros, subrubros, subrubros2, subrubros3] = await Promise.all([
    prisma.empresa.findMany({
      where: { unidades: { some: { unidadNegocioId: codUnidad } } },
      select: {
        codEmp: true,
        nombreEmp: true,
        comparteBsys: true,
        unidades: { select: { unidadNegocio: { select: { codUnidad: true, nombreUnidad: true } } } },
      },
    }),
    prisma.partidaPatrimonial.findMany({ select: { codPartida: true, nomPartida: true } }),
    prisma.rubro.findMany({ select: { codRubro: true, nomRubro: true, partidaPatrimonialId: true } }),
    prisma.subrubro.findMany({ select: { codSubrubro: true, nomSubrubro: true } }),
    prisma.subrubro2.findMany({ select: { codSubrubro2: true, nomSubrubro2: true } }),
    prisma.subrubro3.findMany({ select: { codSubrubro3: true, nomSubrubro3: true } }),
  ]);
  if (empresasDb.length === 0) {
    return { tipo: "error", mensaje: "Esta unidad de negocio no tiene empresas vinculadas." };
  }

  const existentes = await prisma.planDeCuentas.findMany({
    where: { empresaId: { in: empresasDb.map((e) => e.codEmp) } },
    select: { empresaId: true, cuenta: true },
  });
  const codigosExistentes = new Map<number, Set<string>>();
  const empresasConCuentas = new Set<number>();
  for (const e of existentes) {
    empresasConCuentas.add(e.empresaId);
    const codigo = codigoNumerico(e.cuenta);
    if (!codigo) continue;
    const set = codigosExistentes.get(e.empresaId) ?? new Set<string>();
    set.add(codigo);
    codigosExistentes.set(e.empresaId, set);
  }
  // Carga inicial = la Empresa todavía no tiene ninguna cuenta.
  const empresasIniciales = new Set(
    empresasDb.filter((e) => !empresasConCuentas.has(e.codEmp)).map((e) => e.codEmp)
  );

  const analisis = analizarFilas(
    lectura.filas,
    {
      empresas: empresasDb.map((e) => ({
        id: e.codEmp,
        nombre: e.nombreEmp,
        comparteBsys: e.comparteBsys,
        unidades: e.unidades.map((u) => ({ id: u.unidadNegocio.codUnidad, nombre: u.unidadNegocio.nombreUnidad })),
      })),
      partidas: partidas.map((p) => ({ id: p.codPartida, nombre: p.nomPartida })),
      rubros: rubros.map((r) => ({ id: r.codRubro, nombre: r.nomRubro, partidaId: r.partidaPatrimonialId })),
      subrubros: subrubros.map((s) => ({ id: s.codSubrubro, nombre: s.nomSubrubro })),
      subrubros2: subrubros2.map((s) => ({ id: s.codSubrubro2, nombre: s.nomSubrubro2 })),
      subrubros3: subrubros3.map((s) => ({ id: s.codSubrubro3, nombre: s.nomSubrubro3 })),
    },
    { empresasIniciales, codigosExistentes, resoluciones: leerResoluciones(formData) }
  );

  if (analisis.conflictos.length > 0) {
    return { tipo: "conflictos", conflictos: analisis.conflictos };
  }

  // En una Empresa que comparte BSyS cada cuenta trae su Unidad en "Cuit
  // compartido" (obligatorio, ya validado); en el resto queda en null.
  if (analisis.aCargar.length > 0) {
    await prisma.planDeCuentas.createMany({
      data: analisis.aCargar.map((c) => ({
        empresaId: c.empresaId,
        cuenta: c.cuenta,
        rubroId: c.rubroId,
        subrubroId: c.subrubroId,
        subrubro2Id: c.subrubro2Id,
        subrubro3Id: c.subrubro3Id,
        unidadNegocioId: c.unidadNegocioId,
      })),
      skipDuplicates: true,
    });
    revalidatePath(`/configuracion/plan-de-cuentas/${codUnidad}`);
    revalidatePath("/configuracion/plan-de-cuentas");
  }

  return {
    tipo: "resultado",
    totalFilas: analisis.aCargar.length + analisis.descartadasExistentes.length + analisis.descartadasError.length,
    cargadas: analisis.aCargar.length,
    descartadasExistentes: analisis.descartadasExistentes.length,
    ejemplosExistentes: analisis.descartadasExistentes.slice(0, 5).map((d) => d.cuenta),
    errores: analisis.descartadasError.slice(0, MAX_ERRORES_EN_RESPUESTA),
    erroresOmitidos: Math.max(0, analisis.descartadasError.length - MAX_ERRORES_EN_RESPUESTA),
  };
}
