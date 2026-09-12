import { prisma } from "@/lib/prisma";
import { computeResultadoNominalMes, type ResultadoNominal } from "@/lib/resultado-nominal";

const CAMPOS: (keyof ResultadoNominal)[] = [
  "ventas",
  "costosDirectos",
  "gastosOperativos",
  "expensas",
  "otrasGananciasYPerdidas",
];

function vacio(): ResultadoNominal {
  return { ventas: 0, costosDirectos: 0, gastosOperativos: 0, expensas: 0, otrasGananciasYPerdidas: 0 };
}

function sumar(a: ResultadoNominal, b: ResultadoNominal): ResultadoNominal {
  const r = vacio();
  for (const c of CAMPOS) r[c] = a[c] + b[c];
  return r;
}

function periodoSiguiente(mes: number, anio: number): { mes: number; anio: number } {
  return mes === 12 ? { mes: 1, anio: anio + 1 } : { mes: mes + 1, anio };
}

function periodosDelRango(
  desde: { mes: number; anio: number },
  hasta: { mes: number; anio: number }
): { mes: number; anio: number }[] {
  const periodos: { mes: number; anio: number }[] = [];
  let cursor = desde;
  while (cursor.anio < hasta.anio || (cursor.anio === hasta.anio && cursor.mes <= hasta.mes)) {
    periodos.push(cursor);
    cursor = periodoSiguiente(cursor.mes, cursor.anio);
  }
  return periodos;
}

async function sumaHistorico(
  empresaId: number,
  desde: { mes: number; anio: number },
  hasta: { mes: number; anio: number }
): Promise<{ total: ResultadoNominal; completo: boolean }> {
  const periodos = periodosDelRango(desde, hasta);
  const filas = await prisma.resultadosHistoricos.findMany({
    where: { empresaId, OR: periodos.map((p) => ({ periodoMes: p.mes, periodoAnio: p.anio })) },
  });

  let total = vacio();
  for (const f of filas) {
    total = sumar(total, {
      ventas: Number(f.ventas),
      costosDirectos: Number(f.costosDirectos),
      gastosOperativos: Number(f.gastosOperativos),
      expensas: Number(f.expensas),
      otrasGananciasYPerdidas: Number(f.otrasGananciasYPerdidas),
    });
  }
  return { total, completo: filas.length === periodos.length };
}

async function unPeriodoHistorico(
  empresaId: number,
  mes: number,
  anio: number
): Promise<ResultadoNominal | null> {
  const fila = await prisma.resultadosHistoricos.findUnique({
    where: { empresaId_periodoMes_periodoAnio: { empresaId, periodoMes: mes, periodoAnio: anio } },
  });
  if (!fila) return null;
  return {
    ventas: Number(fila.ventas),
    costosDirectos: Number(fila.costosDirectos),
    gastosOperativos: Number(fila.gastosOperativos),
    expensas: Number(fila.expensas),
    otrasGananciasYPerdidas: Number(fila.otrasGananciasYPerdidas),
  };
}

export type ResultadoColumna = ResultadoNominal & {
  margenContribucion: number;
  pctMC: number;
  resultadoOperativo: number;
  pctRentabilidadNegocio: number;
  rentabilidadNeta: number;
  pctRentabilidadNeta: number;
};

function derivar(v: ResultadoNominal): ResultadoColumna {
  const margenContribucion = v.ventas + v.costosDirectos;
  const resultadoOperativo = margenContribucion + v.gastosOperativos;
  const rentabilidadNeta = resultadoOperativo + v.expensas + v.otrasGananciasYPerdidas;
  const div = (n: number, d: number) => (d !== 0 ? n / d : 0);
  return {
    ...v,
    margenContribucion,
    pctMC: div(margenContribucion, v.ventas),
    resultadoOperativo,
    pctRentabilidadNegocio: div(resultadoOperativo, v.ventas),
    rentabilidadNeta,
    pctRentabilidadNeta: div(rentabilidadNeta, v.ventas),
  };
}

export type ResultadoCuadro = {
  informeId: string;
  empresaId: number;
  empresaNombre: string;
  periodoMes: number;
  periodoAnio: number;
  nominal: {
    actual: ResultadoColumna;
    mismoMesAnioAnterior: ResultadoColumna;
    acumuladoActual: ResultadoColumna;
    acumuladoAnterior: ResultadoColumna;
    promedio: ResultadoColumna;
  };
  advertencias: string[];
};

export async function computeResultadoCuadro(informeId: string): Promise<ResultadoCuadro> {
  const informe = await prisma.informe.findUniqueOrThrow({
    where: { id: informeId },
    include: { empresa: true },
  });
  const { empresaId, periodoMes, periodoAnio } = informe;
  const advertencias: string[] = [];

  const { valores: actualRaw, advertencias: advertenciasMes } =
    await computeResultadoNominalMes(empresaId);
  advertencias.push(...advertenciasMes);
  const actual = actualRaw ?? vacio();

  const mismoMesAnterior = await unPeriodoHistorico(empresaId, periodoMes, periodoAnio - 1);
  if (!mismoMesAnterior) {
    advertencias.push(
      `No hay datos en Resultados Históricos para ${String(periodoMes).padStart(2, "0")}-${periodoAnio - 1}.`
    );
  }

  // 12 meses terminando en el período actual: los 11 anteriores salen de
  // Resultados Históricos, el propio período usa el dato recién calculado
  // (más fresco que lo que pueda haber en la tabla histórica).
  const desdeActual = periodoSiguiente(periodoMes, periodoAnio - 1);
  const hastaActual = { mes: periodoMes, anio: periodoAnio };
  const rango11MesesActual = periodosDelRango(desdeActual, hastaActual).slice(0, -1);
  const { total: acum11MesesActual, completo: completoActual } = await sumaHistorico(
    empresaId,
    rango11MesesActual[0]!,
    rango11MesesActual[rango11MesesActual.length - 1]!
  );
  if (!completoActual) {
    advertencias.push(
      "Faltan períodos en Resultados Históricos para completar los últimos 12 meses del período actual."
    );
  }
  const acumuladoActualRaw = sumar(acum11MesesActual, actual);

  // 12 meses terminando en el mismo mes del año anterior, todo desde
  // Resultados Históricos (son períodos ya cerrados).
  const hastaAnterior = { mes: periodoMes, anio: periodoAnio - 1 };
  const desdeAnterior = periodoSiguiente(periodoMes, periodoAnio - 2);
  const { total: acumuladoAnteriorRaw, completo: completoAnterior } = await sumaHistorico(
    empresaId,
    desdeAnterior,
    hastaAnterior
  );
  if (!completoAnterior) {
    advertencias.push(
      "Faltan períodos en Resultados Históricos para completar los 12 meses del mismo período del año anterior."
    );
  }

  const promedioRaw = vacio();
  for (const c of CAMPOS) promedioRaw[c] = acumuladoActualRaw[c] / 12;

  return {
    informeId: informe.id,
    empresaId,
    empresaNombre: informe.empresa.nombreEmp,
    periodoMes,
    periodoAnio,
    nominal: {
      actual: derivar(actual),
      mismoMesAnioAnterior: derivar(mismoMesAnterior ?? vacio()),
      acumuladoActual: derivar(acumuladoActualRaw),
      acumuladoAnterior: derivar(acumuladoAnteriorRaw),
      promedio: derivar(promedioRaw),
    },
    advertencias,
  };
}
