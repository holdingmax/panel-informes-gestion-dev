import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

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

// Nombres de Rubro tal como vienen clasificados en el Plan de Cuentas para
// las cuentas de Resultado (ver HOJA LLAVE del archivo de indicadores) — no
// hay nada hardcodeado de cuenta a cuenta, se agrupa por el Rubro que ya
// tiene cada una configurado en Configuración → Plan de Cuentas.
const RUBRO_A_CAMPO: Record<string, keyof ResultadoNominal> = {
  VENTAS: "ventas",
  "Costos directos/variables": "costosDirectos",
  "Gastos Fijos Operativos": "gastosOperativos",
  EXPENSAS: "expensas",
  "Otras Ganancias y Perdidas": "otrasGananciasYPerdidas",
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
};

// Función pura: sin Prisma, para poder testearla con datos armados a mano.
// El BSyS "Mes" trae, para cada cuenta, el saldo acumulado a fin del mes
// anterior (saldo inicio) y a fin de este mes (saldo cierre) — el movimiento
// propio del mes es la diferencia entre ambos, no el saldo de cierre solo.
export function computeResultadoNominalDeEmpresaPure(
  empresaNombre: string,
  balances: BalanceMesInput[],
  planDeCuentas: PlanCuentaResultadoInput[]
): { valores: ResultadoNominal; advertencias: string[] } {
  const advertencias: string[] = [];
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

    const campo = RUBRO_A_CAMPO[plan.nomRubro];
    if (!campo) {
      advertencias.push(
        `El rubro "${plan.nomRubro}" (cuenta "${b.cuenta}", ${empresaNombre}) no corresponde a ninguno de los 5 campos de Resultado (Ventas, Costos directos/variables, Gastos Fijos Operativos, Expensas, Otras Ganancias y Perdidas).`
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
  }

  const valores = vacio();
  for (const campo of Object.keys(valores) as (keyof ResultadoNominal)[]) {
    valores[campo] = round2(acumulado[campo]);
  }

  return { valores, advertencias };
}

async function computeResultadoNominalMesDeEmpresa(
  empresaId: number,
  empresaNombre: string,
  periodoMes: number,
  periodoAnio: number
): Promise<{
  valores: ResultadoNominal | null;
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
    include: { rubro: true, partidaPatrimonial: { include: { tipo: true } } },
  });

  const { valores, advertencias } = computeResultadoNominalDeEmpresaPure(
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
      tipoRol: p.partidaPatrimonial.tipo?.rol ?? null,
    }))
  );

  return { valores, fechaCarga: ultimoMes.fechaCarga, advertencias };
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
  fechaCarga: Date | null;
  advertencias: string[];
}> {
  const empresas = await prisma.empresa.findMany({ where: { unidadNegocioId } });
  if (empresas.length === 0) {
    return {
      valores: null,
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
    return { valores: null, fechaCarga: null, advertencias };
  }

  const valores = vacio();
  for (const r of conDatos) {
    for (const campo of Object.keys(valores) as (keyof ResultadoNominal)[]) {
      valores[campo] += r.valores![campo];
    }
  }

  const fechaCarga = conDatos
    .map((r) => r.fechaCarga!)
    .reduce((max, f) => (f > max ? f : max));

  return { valores, fechaCarga, advertencias };
}
