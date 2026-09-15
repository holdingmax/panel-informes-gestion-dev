import { prisma } from "@/lib/prisma";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

const MESES_ABREV = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function formatPeriodoAbrev(mes: number, anio: number): string {
  return `${MESES_ABREV[mes - 1]}-${String(anio).slice(-2)}`;
}

export type RubroLine = {
  codRubro: number;
  nombre: string;
  // Saldos crudos (Debe - Haber), sin convertir a una convención de
  // presentación: Activo sale naturalmente positivo, Pasivo y Patrimonio Neto
  // naturalmente negativo — así se muestran en el Estado Patrimonial.
  saldoInicio: number;
  saldoFinal: number;
  // Columna "Origen (Aplicación)" del Estado Patrimonial: Activo = inicio -
  // final, Pasivo/PN = final - inicio (mismo signo crudo, sin más ajuste).
  variacion: number;
  // Columna del Estado de Origen y Aplicación de Fondos: depende de la
  // clasificación Origen/Aplicación del Rubro (no de si es Activo o
  // Pasivo/PN), para que dos rubros con la misma clasificación sumen
  // consistentemente sin importar de qué lado del balance estén.
  origenAplicacion: number;
};

export type InformeReport = {
  informeId: string;
  unidadNegocioId: number;
  unidadNegocioNombre: string;
  periodoMes: number;
  periodoAnio: number;
  periodoLabel: string;
  periodoAnteriorLabel: string;
  estado: string;
  fechaCargaAcumulado: Date | null;
  balance: {
    activo: RubroLine[];
    pasivo: RubroLine[];
    patrimonioNeto: RubroLine[];
    totalActivo: number;
    totalActivoAnterior: number;
    totalPasivo: number;
    totalPasivoAnterior: number;
    totalPatrimonioNeto: number;
    totalPatrimonioNetoAnterior: number;
    control: number;
    controlAnterior: number;
  };
  resultadoDelPeriodo: number;
  resultadoDelPeriodoAnterior: number;
  resultadoInicioNoDistribuido: number;
  resultadosAcumuladosSDifPatrimonial: number;
  origenAplicacion: {
    origenes: RubroLine[];
    aplicaciones: RubroLine[];
    ajustes: RubroLine[];
    totalOrigenes: number;
    totalAplicaciones: number;
  };
  nof: {
    // Cada línea ya viene con el signo "de exposición" (positivo = aplicó
    // fondos / aumentó la necesidad, negativo = liberó fondos) — ver el
    // comentario junto a `nofLine` más abajo.
    operativo: RubroLine[];
    noOperativo: RubroLine[];
    financiamiento: RubroLine[];
    totalOperativo: number;
    totalNoOperativo: number;
    totalFinanciamiento: number;
    resultadoVsNOF: number;
    control: number;
  };
  advertencias: string[];
};

type RubroAgg = {
  codRubro: number;
  nomRubro: string;
  categoriaOyA: "ORIGEN" | "APLICACION" | "AJUSTE" | null;
  tipoPartida: "ACTIVO" | "PASIVO" | "PATRIMONIO_NETO" | "RESULTADO" | null;
  saldoInicio: number;
  saldoFinal: number;
};

type NofAgg = {
  codRubro: number;
  nomRubro: string;
  categoriaOyARubro: "ORIGEN" | "APLICACION" | "AJUSTE" | null;
  bucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO";
  saldoInicio: number;
  saldoFinal: number;
};

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

function toLine(r: RubroAgg): RubroLine {
  const variacion =
    r.tipoPartida === "ACTIVO" ? r.saldoInicio - r.saldoFinal : r.saldoFinal - r.saldoInicio;

  let origenAplicacion = 0;
  if (r.categoriaOyA === "APLICACION") {
    origenAplicacion = r.saldoInicio - r.saldoFinal;
  } else if (r.categoriaOyA === "ORIGEN" || r.categoriaOyA === "AJUSTE") {
    origenAplicacion = r.saldoFinal - r.saldoInicio;
  }

  return {
    codRubro: r.codRubro,
    nombre: r.nomRubro,
    saldoInicio: r.saldoInicio,
    saldoFinal: r.saldoFinal,
    variacion,
    origenAplicacion,
  };
}

// Un bucket de NOF puede mezclar rubros de Origen (p. ej. Deudas Comerciales)
// y de Aplicación (p. ej. Disponibilidades): para que sumen consistentemente
// dentro del mismo bucket hay que mostrar cada uno con el MISMO criterio que
// ya usa la hoja 4 (columna Orígenes tal cual, columna Aplicaciones
// invertida) — no una negación pareja para todos, que rompería la resta
// entre Orígenes y Aplicaciones dentro de un mismo bucket mixto.
function nofLine(r: NofAgg): RubroLine {
  const line = toLine({ ...r, categoriaOyA: r.categoriaOyARubro, tipoPartida: null });
  const origenAplicacion =
    r.categoriaOyARubro === "APLICACION" ? -line.origenAplicacion : line.origenAplicacion;
  return { ...line, origenAplicacion };
}

export async function computeInformeReport(informeId: string): Promise<InformeReport> {
  const informe = await prisma.informe.findUniqueOrThrow({
    where: { id: informeId },
    include: { unidadNegocio: true },
  });

  const advertencias: string[] = [];

  // Una Unidad de Negocio puede combinar el Plan de Cuentas y el BSyS de
  // varias Empresas: se consolida sumando, rubro por rubro, la carga
  // ACUMULADO más reciente de cada una — cada Empresa avanza a su propio
  // ritmo, así que no se exige que compartan la misma fechaCarga exacta.
  const empresas = await prisma.empresa.findMany({ where: { unidadNegocioId: informe.unidadNegocioId } });
  if (empresas.length === 0) {
    advertencias.push("Esta unidad de negocio no tiene empresas vinculadas.");
  }

  const rubroMap = new Map<number, RubroAgg>();
  // Clasificado por cuenta (no por Rubro): dos cuentas de un mismo Rubro
  // pueden caer en buckets de NOF distintos, así que se agrupa por la
  // combinación Rubro + Categoría OyA.
  const nofMap = new Map<string, NofAgg>();

  let fechaCargaAcumulado: Date | null = null;

  for (const empresa of empresas) {
    const ultimoAcumulado = await prisma.balanceSumasYSaldos.findFirst({
      where: { empresaId: empresa.codEmp, tipo: "ACUMULADO" },
      orderBy: { fechaCarga: "desc" },
      select: { fechaCarga: true },
    });

    if (!ultimoAcumulado) {
      advertencias.push(`Todavía no se cargó ningún BSyS Acumulado para "${empresa.nombreEmp}".`);
      continue;
    }
    if (!fechaCargaAcumulado || ultimoAcumulado.fechaCarga > fechaCargaAcumulado) {
      fechaCargaAcumulado = ultimoAcumulado.fechaCarga;
    }

    const balances = await prisma.balanceSumasYSaldos.findMany({
      where: {
        empresaId: empresa.codEmp,
        tipo: "ACUMULADO",
        fechaCarga: ultimoAcumulado.fechaCarga,
      },
    });

    const planDeCuentas = await prisma.planDeCuentas.findMany({
      where: { empresaId: empresa.codEmp },
      include: { rubro: true, partidaPatrimonial: true, categoriaOyA: true },
    });
    const porCuenta = new Map(planDeCuentas.map((p) => [normalizeCuenta(p.cuenta), p]));

    for (const b of balances) {
      const plan = porCuenta.get(normalizeCuenta(b.cuenta));
      if (!plan) {
        advertencias.push(
          `La cuenta "${b.cuenta}" (${empresa.nombreEmp}) no está clasificada en el Plan de Cuentas actual y se excluyó del informe.`
        );
        continue;
      }

      const debeHaber = Number(b.saldoIniDebe) - Number(b.saldoIniHaber);
      const debeHaberFinal = Number(b.saldoCierreDebe) - Number(b.saldoCierreHaber);

      let agg = rubroMap.get(plan.rubroId);
      if (!agg) {
        agg = {
          codRubro: plan.rubro.codRubro,
          nomRubro: plan.rubro.nomRubro,
          categoriaOyA: plan.rubro.categoriaOyA,
          tipoPartida: plan.partidaPatrimonial.tipo,
          saldoInicio: 0,
          saldoFinal: 0,
        };
        rubroMap.set(plan.rubroId, agg);
      }
      agg.saldoInicio += debeHaber;
      agg.saldoFinal += debeHaberFinal;

      const bucketNOF = plan.categoriaOyA?.bucketNOF;
      if (bucketNOF) {
        const key = `${plan.rubroId}:${plan.categoriaOyAId}`;
        let nofAgg = nofMap.get(key);
        if (!nofAgg) {
          nofAgg = {
            codRubro: plan.rubro.codRubro,
            nomRubro: plan.rubro.nomRubro,
            categoriaOyARubro: plan.rubro.categoriaOyA,
            bucketNOF,
            saldoInicio: 0,
            saldoFinal: 0,
          };
          nofMap.set(key, nofAgg);
        }
        nofAgg.saldoInicio += debeHaber;
        nofAgg.saldoFinal += debeHaberFinal;
      }
    }
  }

  const rubros = [...rubroMap.values()];

  for (const r of rubros) {
    if (!r.tipoPartida) {
      advertencias.push(
        `El rubro "${r.nomRubro}" no tiene Partida (Activo/Pasivo/Patrimonio Neto/Resultado) clasificada — se excluyó del informe. Clasificala en Configuración → Partida Patrimonial.`
      );
    }
  }

  const activoRubros = rubros.filter((r) => r.tipoPartida === "ACTIVO");
  const pasivoRubros = rubros.filter((r) => r.tipoPartida === "PASIVO");
  const patrimonioNetoRubros = rubros.filter((r) => r.tipoPartida === "PATRIMONIO_NETO");
  const resultadoRubros = rubros.filter((r) => r.tipoPartida === "RESULTADO");
  const balanceRubros = [...activoRubros, ...pasivoRubros, ...patrimonioNetoRubros];

  // Crudo, sin convertir a "ganancia positiva": todo el resto de esta hoja
  // (Pasivo, Patrimonio Neto) también se muestra en su signo de mayor tal
  // cual, así que el Resultado del período tiene que seguir la misma
  // convención para que el renglón "Control" cierre siempre en cero (es la
  // identidad de partida doble: Activo + Pasivo + Patrimonio Neto + Resultado
  // = 0, usando los saldos tal cual vienen, sin ningún signo dado vuelta).
  const resultadoDelPeriodo = sum(resultadoRubros.map((r) => r.saldoFinal));
  const resultadoDelPeriodoAnterior = sum(resultadoRubros.map((r) => r.saldoInicio));

  // Si las cuentas de Resultado (Ingresos/Egresos) de este BSyS Acumulado no
  // arrancan en cero — el "saldo inicio" del archivo no coincide con el
  // comienzo real del ejercicio — esas cuentas ya traían una porción de
  // resultado generada antes del período que cubre este informe. Sin esta
  // línea, esa porción queda sin explicar en el Estado de Origen y Aplicación
  // de Fondos y el total de Orígenes no cierra contra el de Aplicaciones. En
  // una empresa donde el Acumulado sí arranca en cero, este valor da 0 y no
  // se muestra ninguna línea.
  const resultadoInicioNoDistribuido = -resultadoDelPeriodoAnterior;

  const rdoPeriodoLine: RubroLine = {
    codRubro: -1,
    nombre: "Resultado del período",
    saldoInicio: resultadoDelPeriodoAnterior,
    saldoFinal: resultadoDelPeriodo,
    variacion: resultadoDelPeriodo,
    origenAplicacion: resultadoDelPeriodo,
  };

  const activo = activoRubros.map(toLine);
  const pasivo = pasivoRubros.map(toLine);
  const patrimonioNeto = [...patrimonioNetoRubros.map(toLine), rdoPeriodoLine];

  const totalActivo = sum(activo.map((l) => l.saldoFinal));
  const totalActivoAnterior = sum(activo.map((l) => l.saldoInicio));
  const totalPasivo = sum(pasivo.map((l) => l.saldoFinal));
  const totalPasivoAnterior = sum(pasivo.map((l) => l.saldoInicio));
  const totalPatrimonioNeto = sum(patrimonioNeto.map((l) => l.saldoFinal));
  const totalPatrimonioNetoAnterior = sum(patrimonioNeto.map((l) => l.saldoInicio));

  const control = totalActivo + totalPasivo + totalPatrimonioNeto;
  const controlAnterior = totalActivoAnterior + totalPasivoAnterior + totalPatrimonioNetoAnterior;

  const origenes: RubroLine[] = [];
  const aplicaciones: RubroLine[] = [];
  const ajustes: RubroLine[] = [];
  for (const r of balanceRubros) {
    if (!r.categoriaOyA) {
      advertencias.push(
        `El rubro "${r.nomRubro}" no tiene Origen/Aplicación clasificado — se excluyó del Estado de Origen y Aplicación de Fondos. Clasificalo en Configuración → Rubro.`
      );
      continue;
    }
    const line = toLine(r);
    if (r.categoriaOyA === "ORIGEN") origenes.push(line);
    else if (r.categoriaOyA === "APLICACION") aplicaciones.push(line);
    else ajustes.push(line);
  }

  // "Resultados Acumulados S/Indicadores" (el resultado del período) y los
  // rubros marcados AJUSTE (p. ej. Resultados Acumulados) siempre entran al
  // total de Orígenes, sea cual sea su signo — es la convención habitual de
  // este estado: el resultado del ejercicio es la primera línea de Orígenes,
  // ya sea una ganancia o una pérdida.
  const totalOrigenes =
    sum(origenes.map((l) => l.origenAplicacion)) +
    sum(ajustes.map((l) => l.origenAplicacion)) +
    resultadoDelPeriodo +
    resultadoInicioNoDistribuido;
  const totalAplicaciones = sum(aplicaciones.map((l) => l.origenAplicacion));

  const operativo: RubroLine[] = [];
  const noOperativo: RubroLine[] = [];
  const financiamiento: RubroLine[] = [];
  for (const r of nofMap.values()) {
    const line = nofLine(r);
    if (r.bucketNOF === "OPERATIVO") operativo.push(line);
    else if (r.bucketNOF === "NO_OPERATIVO") noOperativo.push(line);
    else financiamiento.push(line);
  }

  const totalOperativo = sum(operativo.map((l) => l.origenAplicacion));
  const totalNoOperativo = sum(noOperativo.map((l) => l.origenAplicacion));
  const totalFinanciamiento = sum(financiamiento.map((l) => l.origenAplicacion));

  // "Resultados Acumulados S/Indicadores" y "Ajustes Ejercicios Anteriores"
  // son la misma información de la hoja 4, mostrada de otro modo — no se
  // recalculan acá. "Resultado vs NOF" = esos dos más el Aumento (Disminución)
  // de NOF; el control de abajo (Resultado vs NOF + No operativas +
  // Financiamiento) tiene que cerrar en 0, la misma identidad de partida doble
  // que ya usa el Control de la hoja 2, sólo que reagrupada de otra forma.
  const ajustesTotal = sum(ajustes.map((l) => l.origenAplicacion));
  const resultadosAcumuladosSDifPatrimonial =
    resultadoDelPeriodo + resultadoInicioNoDistribuido + ajustesTotal;
  const resultadoVsNOF = resultadosAcumuladosSDifPatrimonial + totalOperativo;
  const controlNOF = resultadoVsNOF + totalNoOperativo + totalFinanciamiento;

  return {
    informeId: informe.id,
    unidadNegocioId: informe.unidadNegocioId,
    unidadNegocioNombre: informe.unidadNegocio.nombreUnidad,
    periodoMes: informe.periodoMes,
    periodoAnio: informe.periodoAnio,
    periodoLabel: formatPeriodoAbrev(informe.periodoMes, informe.periodoAnio),
    periodoAnteriorLabel: formatPeriodoAbrev(informe.periodoMes, informe.periodoAnio - 1),
    estado: informe.estado,
    fechaCargaAcumulado,
    balance: {
      activo,
      pasivo,
      patrimonioNeto,
      totalActivo,
      totalActivoAnterior,
      totalPasivo,
      totalPasivoAnterior,
      totalPatrimonioNeto,
      totalPatrimonioNetoAnterior,
      control,
      controlAnterior,
    },
    resultadoDelPeriodo,
    resultadoDelPeriodoAnterior,
    resultadoInicioNoDistribuido,
    resultadosAcumuladosSDifPatrimonial,
    origenAplicacion: { origenes, aplicaciones, ajustes, totalOrigenes, totalAplicaciones },
    nof: {
      operativo,
      noOperativo,
      financiamiento,
      totalOperativo,
      totalNoOperativo,
      totalFinanciamiento,
      resultadoVsNOF,
      control: controlNOF,
    },
    advertencias,
  };
}
