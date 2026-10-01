import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { CampoResultado } from "@/generated/prisma/enums";
import { normalizeCuenta } from "@/lib/cuenta-normalize";
import type { InformeSnapshot } from "@/lib/balance-oya-report";

function round2(d: Prisma.Decimal): number {
  return d.toDecimalPlaces(2).toNumber();
}

export type ResultadoNominal = {
  ventas: number;
  costosDirectos: number;
  gastosOperativos: number;
  expensas: number;
  otrasGananciasYPerdidas: number;
};

// Fallback de transición: nombres de Rubro tal como venían clasificados en
// el Plan de Cuentas para las cuentas de Resultado (ver HOJA LLAVE del
// archivo de indicadores), de cuando el ER se armaba por nombre de Rubro en
// vez de por Subrubro.campoResultado (ver CAMPO_RESULTADO_A_CLAVE). Se usa
// solo mientras algún Subrubro todavía no tiene su campo clasificado en
// Configuración → Subrubro — sacar una vez que todos estén clasificados.
const RUBRO_A_CAMPO: Record<string, keyof ResultadoNominal> = {
  VENTAS: "ventas",
  "Costos directos/variables": "costosDirectos",
  "Gastos Fijos Operativos": "gastosOperativos",
  EXPENSAS: "expensas",
  "Otras Ganancias y Perdidas": "otrasGananciasYPerdidas",
};

const CAMPO_RESULTADO_A_CLAVE: Record<CampoResultado, keyof ResultadoNominal> = {
  VENTAS: "ventas",
  COSTOS_DIRECTOS: "costosDirectos",
  GASTOS_OPERATIVOS: "gastosOperativos",
  EXPENSAS: "expensas",
  OTRAS_GANANCIAS_PERDIDAS: "otrasGananciasYPerdidas",
};

function vacio(): ResultadoNominal {
  return {
    ventas: 0,
    costosDirectos: 0,
    gastosOperativos: 0,
    expensas: 0,
    otrasGananciasYPerdidas: 0,
  };
}

function fmtPeriodo(mes: number, anio: number): string {
  return `${String(mes).padStart(2, "0")}/${anio}`;
}

export type BalanceMesInput = {
  cuenta: string;
  saldoIniDebe: number;
  saldoIniHaber: number;
  saldoCierreDebe: number;
  saldoCierreHaber: number;
};

export type PlanCuentaResultadoInput = {
  cuenta: string;
  nomRubro: string;
  tipoRol: "ACTIVO" | "PASIVO" | "PATRIMONIO_NETO" | "RESULTADO" | null;
  subrubroId?: number | null;
  nomSubrubro?: string | null;
  // undefined/null = Subrubro sin clasificar todavía — cae al fallback por
  // nombre de Rubro (RUBRO_A_CAMPO).
  campoResultado?: CampoResultado | null;
};

export type DetalleSubrubroCuenta = {
  // null cuando el detalle sale de un snapshot congelado o de la cuenta no
  // estar clasificada en el Plan de Cuentas — ahí no hay botón Editar.
  planDeCuentaId: string | null;
  empresaNombre: string;
  cuenta: string;
  saldoInicio: number;
  saldoFinal: number;
  subrubroId: number | null;
  nomSubrubro: string | null;
  // El campo del ER al que efectivamente contribuyó esta cuenta (ya
  // resuelto, con el mismo fallback que usa el cálculo) — es la clave del
  // "ojo" de cada fila del cuadro Nominal (ver getDetalleCampoResultado):
  // varios Subrubros distintos pueden resolver al mismo campo.
  campo: keyof ResultadoNominal;
};

// Función pura: sin Prisma, para poder testearla con datos armados a mano.
// El BSyS "Mes" trae, para cada cuenta, el saldo acumulado a fin del mes
// anterior (saldo inicio) y a fin de este mes (saldo cierre) — el movimiento
// propio del mes es la diferencia entre ambos, no el saldo de cierre solo.
export function computeResultadoNominalDeEmpresaPure(
  empresaNombre: string,
  balances: BalanceMesInput[],
  planDeCuentas: PlanCuentaResultadoInput[]
): { valores: ResultadoNominal; cuentas: DetalleSubrubroCuenta[]; advertencias: string[] } {
  const advertencias: string[] = [];
  const cuentas: DetalleSubrubroCuenta[] = [];
  const porCuenta = new Map(planDeCuentas.map((p) => [normalizeCuenta(p.cuenta), p]));
  // Decimal mientras se acumulan las cuentas (pueden ser muchas por campo);
  // se convierte a number recién al final, redondeado a 2 decimales.
  const acumulado: Record<keyof ResultadoNominal, Prisma.Decimal> = {
    ventas: new Prisma.Decimal(0),
    costosDirectos: new Prisma.Decimal(0),
    gastosOperativos: new Prisma.Decimal(0),
    expensas: new Prisma.Decimal(0),
    otrasGananciasYPerdidas: new Prisma.Decimal(0),
  };

  for (const b of balances) {
    const plan = porCuenta.get(normalizeCuenta(b.cuenta));
    if (!plan) {
      advertencias.push(
        `La cuenta "${b.cuenta}" (${empresaNombre}) no está clasificada en el Plan de Cuentas actual.`
      );
      continue;
    }
    if (plan.tipoRol !== "RESULTADO") continue;

    // El Subrubro decide el campo del ER (exclusivo de Rubros de Resultado) —
    // mientras no esté clasificado, cae al fallback por nombre de Rubro.
    const campo = (plan.campoResultado && CAMPO_RESULTADO_A_CLAVE[plan.campoResultado]) ?? RUBRO_A_CAMPO[plan.nomRubro];
    if (!campo) {
      advertencias.push(
        `La cuenta "${b.cuenta}" (${empresaNombre}, rubro "${plan.nomRubro}") no tiene un Subrubro clasificado con Campo del ER, y su rubro tampoco corresponde a ninguno de los 5 campos de Resultado por nombre. Clasificá su Subrubro en Configuración → Subrubro.`
      );
      continue;
    }

    const inicio = new Prisma.Decimal(b.saldoIniDebe).minus(b.saldoIniHaber);
    const cierre = new Prisma.Decimal(b.saldoCierreDebe).minus(b.saldoCierreHaber);
    const movimientoRaw = cierre.minus(inicio);
    // Convención "positivo = favorable" (Ventas positiva, Costos/Gastos
    // negativos): misma que ya usan los datos históricos pre-cargados en
    // Resultados Históricos, es la inversa del signo crudo de mayor.
    acumulado[campo] = acumulado[campo].minus(movimientoRaw);

    cuentas.push({
      planDeCuentaId: null,
      empresaNombre,
      cuenta: b.cuenta,
      saldoInicio: round2(inicio),
      saldoFinal: round2(cierre),
      subrubroId: plan.subrubroId ?? null,
      nomSubrubro: plan.nomSubrubro ?? null,
      campo,
    });
  }

  const valores = vacio();
  for (const campo of Object.keys(valores) as (keyof ResultadoNominal)[]) {
    valores[campo] = round2(acumulado[campo]);
  }

  return { valores, cuentas, advertencias };
}

async function computeResultadoNominalMesDeEmpresa(
  empresaId: number,
  empresaNombre: string,
  periodoMes: number,
  periodoAnio: number
): Promise<{
  valores: ResultadoNominal | null;
  cuentas: DetalleSubrubroCuenta[];
  fechaCarga: Date | null;
  advertencias: string[];
}> {
  // fechaCarga desc solo desempata DENTRO del período (por si alguna vez
  // hay más de una carga del mismo mes) — el filtro real es el período,
  // no "la carga más reciente entre todas".
  const ultimoMes = await prisma.balanceSumasYSaldos.findFirst({
    where: { empresaId, tipo: "MES", periodoMes, periodoAnio },
    orderBy: { fechaCarga: "desc" },
    select: { fechaCarga: true },
  });
  if (!ultimoMes) {
    return {
      valores: null,
      cuentas: [],
      fechaCarga: null,
      advertencias: [
        `No hay BSyS Mes cargado para "${empresaNombre}" en el período ${fmtPeriodo(periodoMes, periodoAnio)}.`,
      ],
    };
  }

  const balances = await prisma.balanceSumasYSaldos.findMany({
    where: { empresaId, tipo: "MES", periodoMes, periodoAnio, fechaCarga: ultimoMes.fechaCarga },
  });

  const planDeCuentas = await prisma.planDeCuentas.findMany({
    where: { empresaId },
    include: { rubro: { include: { partidaPatrimonial: { include: { tipo: true } } } }, subrubro: true },
  });
  const porCuenta = new Map(planDeCuentas.map((p) => [normalizeCuenta(p.cuenta), p]));

  const { valores, cuentas, advertencias } = computeResultadoNominalDeEmpresaPure(
    empresaNombre,
    balances.map((b) => ({
      cuenta: b.cuenta,
      saldoIniDebe: Number(b.saldoIniDebe),
      saldoIniHaber: Number(b.saldoIniHaber),
      saldoCierreDebe: Number(b.saldoCierreDebe),
      saldoCierreHaber: Number(b.saldoCierreHaber),
    })),
    planDeCuentas.map((p) => ({
      cuenta: p.cuenta,
      nomRubro: p.rubro.nomRubro,
      tipoRol: p.rubro.partidaPatrimonial?.tipo?.rol ?? null,
      subrubroId: p.subrubroId,
      nomSubrubro: p.subrubro?.nomSubrubro ?? null,
      campoResultado: p.subrubro?.campoResultado ?? null,
    }))
  );

  // computeResultadoNominalDeEmpresaPure no conoce el id real de
  // PlanDeCuentas (es una función pura) — se completa acá para el botón
  // Editar del drill-down del ER.
  const cuentasConId = cuentas.map((c) => ({
    ...c,
    planDeCuentaId: porCuenta.get(normalizeCuenta(c.cuenta))?.id ?? null,
  }));

  return { valores, cuentas: cuentasConId, fechaCarga: ultimoMes.fechaCarga, advertencias };
}

// Una Unidad de Negocio puede combinar el resultado de varias Empresas: se
// consolida sumando el resultado nominal del período pedido de cada una. Si
// alguna empresa vinculada todavía no tiene BSyS Mes cargado para ese
// período, su aporte queda en cero y se advierte, pero no bloquea el
// cálculo de las demás.
export async function computeResultadoNominalMes(
  unidadNegocioId: number,
  periodoMes: number,
  periodoAnio: number
): Promise<{
  valores: ResultadoNominal | null;
  cuentas: DetalleSubrubroCuenta[];
  fechaCarga: Date | null;
  advertencias: string[];
}> {
  const empresas = await prisma.empresa.findMany({ where: { unidadNegocioId } });
  if (empresas.length === 0) {
    return {
      valores: null,
      cuentas: [],
      fechaCarga: null,
      advertencias: ["Esta unidad de negocio no tiene empresas vinculadas."],
    };
  }

  const porEmpresa = await Promise.all(
    empresas.map((e) => computeResultadoNominalMesDeEmpresa(e.codEmp, e.nombreEmp, periodoMes, periodoAnio))
  );

  const advertencias = porEmpresa.flatMap((r) => r.advertencias);
  const conDatos = porEmpresa.filter((r) => r.valores !== null);
  if (conDatos.length === 0) {
    return { valores: null, cuentas: [], fechaCarga: null, advertencias };
  }

  const valores = vacio();
  for (const r of conDatos) {
    for (const campo of Object.keys(valores) as (keyof ResultadoNominal)[]) {
      valores[campo] += r.valores![campo];
    }
  }
  const cuentas = conDatos.flatMap((r) => r.cuentas);

  const fechaCarga = conDatos
    .map((r) => r.fechaCarga!)
    .reduce((max, f) => (f > max ? f : max));

  return { valores, cuentas, fechaCarga, advertencias };
}

export const CAMPO_LABEL: Record<keyof ResultadoNominal, string> = {
  ventas: "Ventas",
  costosDirectos: "Costos directos/variables",
  gastosOperativos: "Gastos Fijos Operativos",
  expensas: "Expensas",
  otrasGananciasYPerdidas: "Otras Ganancias y Perdidas",
};

export type DetalleCampoResultado = {
  campo: keyof ResultadoNominal;
  label: string;
  congelado: boolean;
  cuentas: DetalleSubrubroCuenta[];
  totalSaldoInicio: number;
  totalSaldoFinal: number;
};

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

// Mismo propósito que getDetalleRubro (balance-oya-report.ts) pero para el
// cuadro Nominal del ER: drill-down "ojo" por campo (Ventas, Costos
// directos/variables, etc.) — varios Subrubros distintos pueden resolver al
// mismo campo, así que se agrupa por campo y no por un único Subrubro; cada
// cuenta trae igual su propio Subrubro para la columna y el botón Editar.
// Lee del snapshot si el informe está congelado o del BSyS Mes actual si no.
export async function getDetalleCampoResultado(
  informeId: string,
  campo: keyof ResultadoNominal
): Promise<DetalleCampoResultado> {
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });

  if (informe.snapshot) {
    const snapshot = informe.snapshot as unknown as InformeSnapshot;
    const cuentas = snapshot.erActual.cuentas.filter((c) => c.campo === campo);
    return {
      campo,
      label: CAMPO_LABEL[campo],
      congelado: true,
      cuentas,
      totalSaldoInicio: sum(cuentas.map((c) => c.saldoInicio)),
      totalSaldoFinal: sum(cuentas.map((c) => c.saldoFinal)),
    };
  }

  const { cuentas: todasLasCuentas } = await computeResultadoNominalMes(
    informe.unidadNegocioId,
    informe.periodoMes,
    informe.periodoAnio
  );
  const cuentas = todasLasCuentas.filter((c) => c.campo === campo);

  return {
    campo,
    label: CAMPO_LABEL[campo],
    congelado: false,
    cuentas,
    totalSaldoInicio: sum(cuentas.map((c) => c.saldoInicio)),
    totalSaldoFinal: sum(cuentas.map((c) => c.saldoFinal)),
  };
}
