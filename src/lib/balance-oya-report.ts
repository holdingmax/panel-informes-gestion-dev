import { prisma } from "@/lib/prisma";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

export type RubroLine = {
  codRubro: number;
  nombre: string;
  saldoInicio: number;
  saldoFinal: number;
  // Positivo = Origen de fondos, negativo = Aplicación de fondos (ya
  // ajustado por la clasificación Origen/Aplicación del rubro, no por su
  // signo contable crudo).
  origenAplicacion: number;
};

export type InformeReport = {
  informeId: string;
  empresaId: number;
  empresaNombre: string;
  periodoMes: number;
  periodoAnio: number;
  estado: string;
  fechaCargaAcumulado: Date | null;
  balance: {
    activo: RubroLine[];
    pasivoYPatrimonioNeto: RubroLine[];
    totalActivo: number;
    totalPasivoPN: number;
  };
  resultadoDelPeriodo: number;
  ajustesEjerciciosAnteriores: number;
  origenAplicacion: {
    origenes: RubroLine[];
    aplicaciones: RubroLine[];
    totalOrigenes: number;
    totalAplicaciones: number;
  };
  nof: {
    operativo: RubroLine[];
    noOperativo: RubroLine[];
    financiamiento: RubroLine[];
    totalOperativo: number;
    totalNoOperativo: number;
    totalFinanciamiento: number;
    resultadoVsNOF: number;
  };
  advertencias: string[];
};

type RubroAgg = {
  codRubro: number;
  nomRubro: string;
  categoriaOyA: "ORIGEN" | "APLICACION" | null;
  bucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO" | null;
  tipoPartida: "ACTIVO" | "PASIVO_PATRIMONIO_NETO" | "RESULTADO" | null;
  saldoInicio: number;
  saldoFinal: number;
};

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

function toLine(r: RubroAgg): RubroLine {
  // Para MOSTRAR el saldo (Balance Sheet), Pasivo/PN se presenta en positivo
  // (convención contable habitual) aunque su saldo natural en el mayor sea
  // acreedor/negativo; Activo ya se muestra tal cual.
  const signoDisplay = r.tipoPartida === "ACTIVO" ? 1 : -1;
  const saldoInicio = r.saldoInicio * signoDisplay;
  const saldoFinal = r.saldoFinal * signoDisplay;

  // Cuánto creció (en su saldo ya "mostrable") este rubro en el período.
  const incremento = saldoFinal - saldoInicio;

  // Un incremento en un rubro de Origen es un Origen de fondos (+); un
  // incremento en un rubro de Aplicación es una Aplicación de fondos (-).
  const signoOyA = r.categoriaOyA === "APLICACION" ? -1 : 1;
  const origenAplicacion = incremento * signoOyA;

  return {
    codRubro: r.codRubro,
    nombre: r.nomRubro,
    saldoInicio,
    saldoFinal,
    origenAplicacion,
  };
}

export async function computeInformeReport(informeId: string): Promise<InformeReport> {
  const informe = await prisma.informe.findUniqueOrThrow({
    where: { id: informeId },
    include: { empresa: true },
  });

  const advertencias: string[] = [];

  const ultimoAcumulado = await prisma.balanceSumasYSaldos.findFirst({
    where: { empresaId: informe.empresaId, tipo: "ACUMULADO" },
    orderBy: { fechaCarga: "desc" },
    select: { fechaCarga: true },
  });

  if (!ultimoAcumulado) {
    advertencias.push("Todavía no se cargó ningún BSyS Acumulado para esta empresa.");
  }

  const balances = ultimoAcumulado
    ? await prisma.balanceSumasYSaldos.findMany({
        where: {
          empresaId: informe.empresaId,
          tipo: "ACUMULADO",
          fechaCarga: ultimoAcumulado.fechaCarga,
        },
      })
    : [];

  const planDeCuentas = await prisma.planDeCuentas.findMany({
    where: { empresaId: informe.empresaId },
    include: { rubro: true, partidaPatrimonial: true },
  });
  const porCuenta = new Map(planDeCuentas.map((p) => [normalizeCuenta(p.cuenta), p]));

  const rubroMap = new Map<number, RubroAgg>();

  for (const b of balances) {
    const plan = porCuenta.get(normalizeCuenta(b.cuenta));
    if (!plan) {
      advertencias.push(
        `La cuenta "${b.cuenta}" no está clasificada en el Plan de Cuentas actual y se excluyó del informe.`
      );
      continue;
    }

    let agg = rubroMap.get(plan.rubroId);
    if (!agg) {
      agg = {
        codRubro: plan.rubro.codRubro,
        nomRubro: plan.rubro.nomRubro,
        categoriaOyA: plan.rubro.categoriaOyA,
        bucketNOF: plan.rubro.bucketNOF,
        tipoPartida: plan.partidaPatrimonial.tipo,
        saldoInicio: 0,
        saldoFinal: 0,
      };
      rubroMap.set(plan.rubroId, agg);
    }
    agg.saldoInicio += Number(b.saldoIniDebe) - Number(b.saldoIniHaber);
    agg.saldoFinal += Number(b.saldoCierreDebe) - Number(b.saldoCierreHaber);
  }

  const rubros = [...rubroMap.values()];

  for (const r of rubros) {
    if (!r.tipoPartida) {
      advertencias.push(
        `El rubro "${r.nomRubro}" no tiene Partida (Activo/Pasivo/Resultado) clasificada — se excluyó del informe. Clasificala en Configuración → Partida Patrimonial.`
      );
    }
  }

  const activoRubros = rubros.filter((r) => r.tipoPartida === "ACTIVO");
  const pasivoRubros = rubros.filter((r) => r.tipoPartida === "PASIVO_PATRIMONIO_NETO");
  const resultadoRubros = rubros.filter((r) => r.tipoPartida === "RESULTADO");
  const balanceRubros = [...activoRubros, ...pasivoRubros];

  const activo = activoRubros.map(toLine);
  const pasivoYPatrimonioNeto = pasivoRubros.map(toLine);
  const totalActivo = sum(activo.map((l) => l.saldoFinal));
  const totalPasivoPN = sum(pasivoYPatrimonioNeto.map((l) => l.saldoFinal));

  const resultadoDelPeriodo = -sum(resultadoRubros.map((r) => r.saldoFinal));

  // Las cuentas de Resultado (Ingresos/Egresos) de este BSyS Acumulado no
  // siempre arrancan en cero: si el "saldo inicio" del archivo no coincide
  // con el comienzo real del ejercicio, esas cuentas ya traen una porción de
  // resultado generada antes del período que cubre este informe. Como
  // "Resultado del Ejercicio" toma el saldo final completo de esas cuentas
  // (necesario para que el Balance de la hoja 2 cierre siempre exacto, sea
  // cual sea ese saldo inicio), esa porción previa queda sin explicar en el
  // Estado de Origen y Aplicación de Fondos si no se la resta aparte —
  // "Ajustes Ejercicios Anteriores" es exactamente esa porción.
  const ajustesEjerciciosAnteriores = sum(resultadoRubros.map((r) => r.saldoInicio));

  const origenes: RubroLine[] = [];
  const aplicaciones: RubroLine[] = [];
  for (const r of balanceRubros) {
    if (!r.categoriaOyA) {
      advertencias.push(
        `El rubro "${r.nomRubro}" no tiene Origen/Aplicación clasificado — se excluyó del Estado de Origen y Aplicación de Fondos. Clasificalo en Configuración → Rubro.`
      );
      continue;
    }
    const line = toLine(r);
    if (r.categoriaOyA === "ORIGEN") origenes.push(line);
    else aplicaciones.push(line);
  }

  // origenAplicacion ya viene con signo "tag-adjusted": positivo = evento de
  // Origen ese período, negativo = evento de Aplicación ese período — tanto
  // para un rubro que se mueve en su dirección habitual como para uno que se
  // mueve al revés (p. ej. un pasivo que en vez de crecer se cancela). Sumar
  // con signo (no por valor absoluto) es lo que garantiza que el total de
  // Orígenes coincida siempre con el total de Aplicaciones — la identidad
  // contable de la que depende todo el estado. En la columna "Aplicaciones"
  // se invierte el signo del grupo porque ahí el caso normal (el rubro creció)
  // es justamente el que da origenAplicacion negativo.
  const totalOrigenes =
    sum(origenes.map((l) => l.origenAplicacion)) +
    Math.max(resultadoDelPeriodo, 0) +
    Math.max(ajustesEjerciciosAnteriores, 0);
  const totalAplicaciones =
    sum(aplicaciones.map((l) => -l.origenAplicacion)) +
    Math.max(-resultadoDelPeriodo, 0) +
    Math.max(-ajustesEjerciciosAnteriores, 0);

  const operativo: RubroLine[] = [];
  const noOperativo: RubroLine[] = [];
  const financiamiento: RubroLine[] = [];
  for (const r of balanceRubros) {
    if (!r.bucketNOF) continue; // no todo rubro necesita bucket de NOF
    const line = toLine(r);
    if (r.bucketNOF === "OPERATIVO") operativo.push(line);
    else if (r.bucketNOF === "NO_OPERATIVO") noOperativo.push(line);
    else financiamiento.push(line);
  }

  // Acá sí se suma con signo: dentro de cada bucket, un Origen suma y una
  // Aplicación resta (es el neto de esa categoría, no una lista de líneas).
  const totalOperativo = sum(operativo.map((l) => l.origenAplicacion));
  const totalNoOperativo = sum(noOperativo.map((l) => l.origenAplicacion));
  const totalFinanciamiento = sum(financiamiento.map((l) => l.origenAplicacion));
  const resultadoVsNOF = resultadoDelPeriodo + totalOperativo;

  return {
    informeId: informe.id,
    empresaId: informe.empresaId,
    empresaNombre: informe.empresa.nombreEmp,
    periodoMes: informe.periodoMes,
    periodoAnio: informe.periodoAnio,
    estado: informe.estado,
    fechaCargaAcumulado: ultimoAcumulado?.fechaCarga ?? null,
    balance: { activo, pasivoYPatrimonioNeto, totalActivo, totalPasivoPN },
    resultadoDelPeriodo,
    ajustesEjerciciosAnteriores,
    origenAplicacion: { origenes, aplicaciones, totalOrigenes, totalAplicaciones },
    nof: {
      operativo,
      noOperativo,
      financiamiento,
      totalOperativo,
      totalNoOperativo,
      totalFinanciamiento,
      resultadoVsNOF,
    },
    advertencias,
  };
}
