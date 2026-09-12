import { prisma } from "@/lib/prisma";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

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

// El BSyS "Mes" trae, para cada cuenta, el saldo acumulado a fin del mes
// anterior (saldo inicio) y a fin de este mes (saldo cierre) — el movimiento
// propio del mes es la diferencia entre ambos, no el saldo de cierre solo.
export async function computeResultadoNominalMes(empresaId: number): Promise<{
  valores: ResultadoNominal | null;
  fechaCarga: Date | null;
  advertencias: string[];
}> {
  const advertencias: string[] = [];
  const ultimoMes = await prisma.balanceSumasYSaldos.findFirst({
    where: { empresaId, tipo: "MES" },
    orderBy: { fechaCarga: "desc" },
    select: { fechaCarga: true },
  });
  if (!ultimoMes) {
    return { valores: null, fechaCarga: null, advertencias: ["No hay ningún BSyS Mes cargado para esta empresa."] };
  }

  const balances = await prisma.balanceSumasYSaldos.findMany({
    where: { empresaId, tipo: "MES", fechaCarga: ultimoMes.fechaCarga },
  });

  const planDeCuentas = await prisma.planDeCuentas.findMany({
    where: { empresaId },
    include: { rubro: true, partidaPatrimonial: true },
  });
  const porCuenta = new Map(planDeCuentas.map((p) => [normalizeCuenta(p.cuenta), p]));

  const valores: ResultadoNominal = {
    ventas: 0,
    costosDirectos: 0,
    gastosOperativos: 0,
    expensas: 0,
    otrasGananciasYPerdidas: 0,
  };

  for (const b of balances) {
    const plan = porCuenta.get(normalizeCuenta(b.cuenta));
    if (!plan) {
      advertencias.push(`La cuenta "${b.cuenta}" no está clasificada en el Plan de Cuentas actual.`);
      continue;
    }
    if (plan.partidaPatrimonial.tipo !== "RESULTADO") continue;

    const campo = RUBRO_A_CAMPO[plan.rubro.nomRubro];
    if (!campo) {
      advertencias.push(
        `El rubro "${plan.rubro.nomRubro}" (cuenta "${b.cuenta}") no corresponde a ninguno de los 5 campos de Resultado (Ventas, Costos directos/variables, Gastos Fijos Operativos, Expensas, Otras Ganancias y Perdidas).`
      );
      continue;
    }

    const inicio = Number(b.saldoIniDebe) - Number(b.saldoIniHaber);
    const cierre = Number(b.saldoCierreDebe) - Number(b.saldoCierreHaber);
    const movimientoRaw = cierre - inicio;
    // Convención "positivo = favorable" (Ventas positiva, Costos/Gastos
    // negativos): misma que ya usan los datos históricos pre-cargados en
    // Resultados Históricos, es la inversa del signo crudo de mayor.
    valores[campo] += -movimientoRaw;
  }

  return { valores, fechaCarga: ultimoMes.fechaCarga, advertencias };
}
