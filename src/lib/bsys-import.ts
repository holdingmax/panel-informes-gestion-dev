"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseBsysRawFile, type BsysRawRow } from "@/lib/bsys-raw-parser";
import { normalizeCuenta } from "@/lib/cuenta-normalize";
import { verificarSeriesCompletaHasta } from "@/lib/series-e-indices-actions";
import { aplicarRefundicion } from "@/lib/refundicion";
import { requireAccesoUnidad } from "@/lib/authz";

function primerDiaDelMes(mes: number, anio: number): Date {
  return new Date(Date.UTC(anio, mes - 1, 1));
}

function ultimoDiaDelMes(mes: number, anio: number): Date {
  return new Date(Date.UTC(anio, mes, 0));
}

// El ejercicio va de julio a junio: el período 06/2026 pertenece al
// ejercicio que arrancó en julio de 2025 (mismo criterio que
// resultado-cuadro.ts).
function inicioEjercicio(mes: number, anio: number): { mes: number; anio: number } {
  return mes >= 7 ? { mes: 7, anio } : { mes: 7, anio: anio - 1 };
}

function fmtFechaISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Los archivos que exporta el sistema contable suelen traer el rango de
// fechas en el propio nombre (ej. "... Desde 2026-06-01 hasta 2026-06-30").
// Si el nombre no trae ese patrón, no se puede validar y se deja pasar — no
// todos los sistemas de origen nombran los archivos así.
function extraerRangoFecha(nombreArchivo: string): { desde: Date; hasta: Date } | null {
  const match = /desde\s+(\d{4}-\d{2}-\d{2})\s+hasta\s+(\d{4}-\d{2}-\d{2})/i.exec(nombreArchivo);
  if (!match) return null;
  const desde = new Date(`${match[1]}T00:00:00Z`);
  const hasta = new Date(`${match[2]}T00:00:00Z`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return null;
  return { desde, hasta };
}

function validarRangoArchivo(archivo: File, desdeEsperado: Date, hastaEsperado: Date): string | null {
  const rango = extraerRangoFecha(archivo.name);
  if (!rango) return null;
  if (rango.desde.getTime() !== desdeEsperado.getTime() || rango.hasta.getTime() !== hastaEsperado.getTime()) {
    return `el archivo "${archivo.name}" no corresponde al período seleccionado — se esperaba un rango "Desde ${fmtFechaISO(desdeEsperado)} hasta ${fmtFechaISO(hastaEsperado)}".`;
  }
  return null;
}

type ImportBsysResult =
  | {
      success: true;
      informeId: string;
      version: number;
      detalle: { empresaNombre: string; cantidadMes: number; cantidadAcumulado: number }[];
      advertencias?: string[];
    }
  | { error: string; empresaNombre?: string; cuentasFaltantes?: string[] };

// Una Unidad de Negocio puede combinar varias Empresas, cada una con su
// propio Plan de Cuentas y por lo tanto su propio par de archivos BSyS
// (Mes y Acumulado) — todas para el mismo período, consolidadas en un solo
// Informe. Los archivos llegan con nombres de campo "archivoMes_<codEmp>" y
// "archivoAcumulado_<codEmp>" por cada empresa vinculada.
export async function importBsysCombinado(formData: FormData): Promise<ImportBsysResult> {
  const unidadNegocioId = Number(formData.get("unidadNegocioId"));
  await requireAccesoUnidad(unidadNegocioId, "confeccionar");
  const periodoMes = Number(formData.get("periodoMes"));
  const periodoAnio = Number(formData.get("periodoAnio"));
  const empresaIds = formData.getAll("empresaId").map(Number);
  const refundicionPendiente = formData.get("refundicionPendiente") === "on";
  // Independiente del estado del informe — ver Informe.auditado. Default
  // "No" si el operador no tocó el control (mismo criterio que
  // refundicionPendiente): cada carga de BSyS vuelve a fijar este valor,
  // no es un interruptor que se mantenga solo.
  const auditado = formData.get("auditadoChoice") === "si";

  if (!Number.isInteger(periodoMes) || periodoMes < 1 || periodoMes > 12) {
    return { error: "Mes inválido." };
  }
  if (!Number.isInteger(periodoAnio) || periodoAnio < 2000) {
    return { error: "Año inválido." };
  }
  if (empresaIds.length === 0) {
    return {
      error:
        "Esta unidad de negocio no tiene empresas vinculadas. Vinculá al menos una en Configuración → Unidades de Negocio.",
    };
  }

  const unidad = await prisma.unidadNegocio.findUniqueOrThrow({ where: { codUnidad: unidadNegocioId } });

  // Si el informe de este período está En Revisión, recargar el BSyS le
  // cambiaría los números a quien lo está revisando — se bloquea, igual que
  // siempre. Si ya está Aprobado (congelado, con snapshot propio), en vez
  // de bloquear se crea una versión nueva más abajo — el aprobado anterior
  // no se toca. Un informe que todavía no existe para este período se
  // carga sin restricción, como versión 1.
  const informeExistente = await prisma.informe.findFirst({
    where: { unidadNegocioId, periodoMes, periodoAnio },
    orderBy: { version: "desc" },
  });
  if (informeExistente?.estado === "EN_REVISION") {
    return { error: "El informe de este período está En revisión. No se puede recargar el BSyS." };
  }

  const empresas = await prisma.empresa.findMany({
    where: { codEmp: { in: empresaIds }, unidadNegocioId },
  });
  if (empresas.length !== empresaIds.length) {
    return { error: "Alguna de las empresas indicadas ya no está vinculada a esta unidad de negocio. Recargá la página." };
  }

  // Series e Índices solo hace falta si alguna Empresa de esta unidad ajusta
  // por inflación o tiene moneda secundaria configurada (ver Configuración →
  // Empresas) — el ESP y el OyAF siempre van en la moneda primaria nominal,
  // sin necesitar ninguna serie.
  const necesitaIndice = empresas.some((e) => e.actualiza);
  const necesitaDolar = empresas.some((e) => e.monedaSecundariaId);
  const necesitaSeries = necesitaIndice || necesitaDolar;
  if (necesitaSeries) {
    const seriesError = await verificarSeriesCompletaHasta(
      unidad.seriesTablaId,
      new Date(Date.UTC(periodoAnio, periodoMes - 1, 1)),
      { indice: necesitaIndice, dolar: necesitaDolar }
    );
    if (seriesError) {
      return {
        error: `${seriesError} Completá Configuración → Series e Índices antes de cargar este período.`,
      };
    }
  }

  type Parsed = {
    empresaId: number;
    empresaNombre: string;
    rowsMes: BsysRawRow[];
    rowsAcumulado: BsysRawRow[];
  };
  const parsedPorEmpresa: Parsed[] = [];
  const advertencias: string[] = [];

  for (const empresa of empresas) {
    const archivoMes = formData.get(`archivoMes_${empresa.codEmp}`);
    const archivoAcumulado = formData.get(`archivoAcumulado_${empresa.codEmp}`);

    if (!(archivoMes instanceof File) || archivoMes.size === 0) {
      return { error: `Seleccioná el archivo de BSyS del Mes de "${empresa.nombreEmp}".` };
    }
    if (!(archivoAcumulado instanceof File) || archivoAcumulado.size === 0) {
      return { error: `Seleccioná el archivo de BSyS Acumulado de "${empresa.nombreEmp}".` };
    }

    const hastaEsperado = ultimoDiaDelMes(periodoMes, periodoAnio);
    const inicioEj = inicioEjercicio(periodoMes, periodoAnio);
    const errorRangoMes = validarRangoArchivo(
      archivoMes,
      primerDiaDelMes(periodoMes, periodoAnio),
      hastaEsperado
    );
    if (errorRangoMes) {
      return { error: `Archivo BSyS del Mes de "${empresa.nombreEmp}": ${errorRangoMes}` };
    }
    const errorRangoAcumulado = validarRangoArchivo(
      archivoAcumulado,
      primerDiaDelMes(inicioEj.mes, inicioEj.anio),
      hastaEsperado
    );
    if (errorRangoAcumulado) {
      return { error: `Archivo BSyS Acumulado de "${empresa.nombreEmp}": ${errorRangoAcumulado}` };
    }

    const [htmlMes, htmlAcumulado] = await Promise.all([
      archivoMes.text(),
      archivoAcumulado.text(),
    ]);
    const rowsMes = parseBsysRawFile(htmlMes);
    let rowsAcumulado = parseBsysRawFile(htmlAcumulado);

    if (rowsMes.length === 0) {
      return {
        error: `No se encontraron cuentas en el archivo de BSyS del Mes de "${empresa.nombreEmp}". Verificá que sea el export correcto del sistema contable.`,
      };
    }
    if (rowsAcumulado.length === 0) {
      return {
        error: `No se encontraron cuentas en el archivo de BSyS Acumulado de "${empresa.nombreEmp}". Verificá que sea el export correcto del sistema contable.`,
      };
    }

    if (refundicionPendiente) {
      const cuentaRNA = String(formData.get(`cuentaRNA_${empresa.codEmp}`) ?? "").trim();
      if (!cuentaRNA) {
        return { error: `Falta indicar la cuenta de RNA de "${empresa.nombreEmp}" para la refundición.` };
      }
      const refundicion = aplicarRefundicion(rowsAcumulado, cuentaRNA);
      if ("error" in refundicion) {
        return { error: `Refundición de "${empresa.nombreEmp}": ${refundicion.error}` };
      }
      rowsAcumulado = refundicion.rows;
      if (refundicion.advertencia) {
        advertencias.push(`Refundición de "${empresa.nombreEmp}": ${refundicion.advertencia}`);
      }
    }

    // Se compara por forma normalizada (mayúsculas/espacios): el mismo nombre
    // de cuenta puede venir con distinto casing entre el Plan de Cuentas
    // (importado desde HOJA LLAVE) y el export del sistema contable.
    const clasificadas = await prisma.planDeCuentas.findMany({
      where: { empresaId: empresa.codEmp },
      select: { cuenta: true },
    });
    const clasificadasSet = new Set(clasificadas.map((p) => normalizeCuenta(p.cuenta)));
    const cuentasArchivo = new Set([
      ...rowsMes.map((r) => r.cuenta),
      ...rowsAcumulado.map((r) => r.cuenta),
    ]);
    const faltantes = [...cuentasArchivo].filter((c) => !clasificadasSet.has(normalizeCuenta(c)));

    if (faltantes.length > 0) {
      return {
        error: `Hay ${faltantes.length} cuenta(s) de "${empresa.nombreEmp}" que no están en su Plan de Cuentas. Agregalas en Configuración → Plan de Cuentas y reintentá.`,
        empresaNombre: empresa.nombreEmp,
        cuentasFaltantes: faltantes,
      };
    }

    parsedPorEmpresa.push({
      empresaId: empresa.codEmp,
      empresaNombre: empresa.nombreEmp,
      rowsMes,
      rowsAcumulado,
    });
  }

  // Un mismo timestamp para todas las filas de todas las empresas de esta
  // carga: computeInformeReport agrupa "la carga más reciente" por
  // fechaCarga exacta, así que calcular new Date() por fila (en vez de una
  // vez por carga) partiría el archivo en más de un batch si el insert
  // cruza un límite de milisegundo.
  const fechaCarga = new Date();

  const toData = (rows: BsysRawRow[], tipo: "MES" | "ACUMULADO", empresaId: number) =>
    rows.map((r) => ({
      empresaId,
      tipo,
      periodoMes,
      periodoAnio,
      fechaCarga,
      cuenta: r.cuenta,
      saldoIniDebe: r.saldoIniDebe,
      saldoIniHaber: r.saldoIniHaber,
      sumasDebe: r.sumasDebe,
      sumasHaber: r.sumasHaber,
      saldoCierreDebe: r.saldoCierreDebe,
      saldoCierreHaber: r.saldoCierreHaber,
    }));

  const informe = await prisma.$transaction(async (tx) => {
    for (const p of parsedPorEmpresa) {
      // Reemplaza la carga anterior de este mismo período (si la había) en
      // vez de apilarla — el informe siempre lee "la carga de este
      // período", no "la más reciente entre todas", así que dejar filas
      // viejas del mismo período no aporta nada y solo arriesga que un bug
      // futuro las vuelva a sumar.
      await tx.balanceSumasYSaldos.deleteMany({
        where: { empresaId: p.empresaId, tipo: "MES", periodoMes, periodoAnio },
      });
      await tx.balanceSumasYSaldos.deleteMany({
        where: { empresaId: p.empresaId, tipo: "ACUMULADO", periodoMes, periodoAnio },
      });
      await tx.balanceSumasYSaldos.createMany({ data: toData(p.rowsMes, "MES", p.empresaId) });
      await tx.balanceSumasYSaldos.createMany({
        data: toData(p.rowsAcumulado, "ACUMULADO", p.empresaId),
      });
    }
    // Re-chequeado dentro de la transacción (no solo arriba) para que dos
    // cargas simultáneas del mismo período no terminen creando dos
    // versiones nuevas a la vez.
    const actual = await tx.informe.findFirst({
      where: { unidadNegocioId, periodoMes, periodoAnio },
      orderBy: { version: "desc" },
    });
    let informe: { id: string; version: number };
    if (!actual) {
      informe = await tx.informe.create({ data: { unidadNegocioId, periodoMes, periodoAnio, auditado } });
    } else if (actual.estado !== "APROBADO") {
      informe = await tx.informe.update({ where: { id: actual.id }, data: { auditado } });
    } else {
      informe = await tx.informe.create({
        data: { unidadNegocioId, periodoMes, periodoAnio, version: actual.version + 1, auditado },
      });
    }
    return informe;
  });

  revalidatePath(`/empresa/${unidadNegocioId}/confeccionar-informe`);
  revalidatePath(`/empresa/${unidadNegocioId}/historico`);

  return {
    success: true,
    informeId: informe.id,
    version: informe.version,
    detalle: parsedPorEmpresa.map((p) => ({
      empresaNombre: p.empresaNombre,
      cantidadMes: p.rowsMes.length,
      cantidadAcumulado: p.rowsAcumulado.length,
    })),
    ...(advertencias.length > 0 ? { advertencias } : {}),
  };
}
