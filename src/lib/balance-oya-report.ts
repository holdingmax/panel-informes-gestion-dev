import { prisma } from "@/lib/prisma";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

export type RubroLine = {
  codRubro: number;
  nombre: string;
  saldoInicio: number;
  saldoFinal: number;
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
    pasivo: RubroLine[];
    totalActivo: number;
    totalPasivoPN: number;
  };
  resultadoDelPeriodo: number;
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
  // Origen/Aplicación replica la fórmula real del Excel sobre los saldos
  // "crudos" del mayor (Debe-Haber): Activo = saldoInicio-saldoFinal,
  // Pasivo/PN = saldoFinal-saldoInicio.
  const origenAplicacion =
    r.tipoPartida === "ACTIVO" ? r.saldoInicio - r.saldoFinal : r.saldoFinal - r.saldoInicio;

  // Para MOSTRAR el saldo (Balance Sheet), Pasivo/PN se presenta en positivo
  // (convención contable habitual) aunque su saldo natural en el mayor sea
  // acreedor/negativo; Activo ya se muestra tal cual.
  const signoDisplay = r.tipoPartida === "ACTIVO" ? 1 : -1;

  return {
    codRubro: r.codRubro,
    nombre: r.nomRubro,
    saldoInicio: r.saldoInicio * signoDisplay,
    saldoFinal: r.saldoFinal * signoDisplay,
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
  const pasivo = pasivoRubros.map(toLine);
  const totalActivo = sum(activo.map((l) => l.saldoFinal));
  const totalPasivoPN = sum(pasivo.map((l) => l.saldoFinal));

  const resultadoDelPeriodo = -sum(resultadoRubros.map((r) => r.saldoFinal));

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

  const totalOrigenes =
    sum(origenes.map((l) => l.origenAplicacion)) + Math.max(resultadoDelPeriodo, 0);
  const totalAplicaciones =
    sum(aplicaciones.map((l) => l.origenAplicacion)) + Math.max(-resultadoDelPeriodo, 0);

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
    balance: { activo, pasivo, totalActivo, totalPasivoPN },
    resultadoDelPeriodo,
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
