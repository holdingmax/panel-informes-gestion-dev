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

function periodoSiguiente(mes: number, anio: number) {
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

// El ejercicio económico va de julio a junio. "Acum XX/YY" siempre acumula
// desde julio del ejercicio correspondiente hasta el período del informe —
// no es una ventana móvil de 12 meses. Al empezar un ejercicio nuevo en
// julio, el acumulado es simplemente el mes de julio (un solo mes).
function inicioEjercicio(mes: number, anio: number) {
  return mes >= 7 ? { mes: 7, anio } : { mes: 7, anio: anio - 1 };
}

function mesesTranscurridosEnEjercicio(mes: number) {
  return mes >= 7 ? mes - 6 : mes + 6;
}

function claveMes(mes: number, anio: number) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
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

export type ResultadoBloque = {
  actual: ResultadoColumna;
  mismoMesAnioAnterior: ResultadoColumna;
  acumuladoActual: ResultadoColumna;
  acumuladoAnterior: ResultadoColumna;
  promedio: ResultadoColumna;
  // Meses transcurridos del ejercicio hasta el período del informe: 1 en
  // julio (primer mes), 12 en junio (cierre) — es el divisor de "promedio" y
  // también se muestra arriba de esa columna en el cuadro.
  mesesTranscurridos: number;
};

export type ResultadoCuadro = {
  informeId: string;
  empresaId: number;
  empresaNombre: string;
  periodoMes: number;
  periodoAnio: number;
  nominal: ResultadoBloque;
  ajustadoPorInflacion: ResultadoBloque | null;
  usd: ResultadoBloque | null;
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

  // Se trae todo de una sola vez (son tablas chicas) en vez de ir mes a mes.
  const historicos = await prisma.resultadosHistoricos.findMany({ where: { empresaId } });
  const historicoMap = new Map<string, ResultadoNominal>();
  for (const h of historicos) {
    historicoMap.set(claveMes(h.periodoMes, h.periodoAnio), {
      ventas: Number(h.ventas),
      costosDirectos: Number(h.costosDirectos),
      gastosOperativos: Number(h.gastosOperativos),
      expensas: Number(h.expensas),
      otrasGananciasYPerdidas: Number(h.otrasGananciasYPerdidas),
    });
  }

  const series = await prisma.seriesEIndices.findMany();
  const seriesMap = new Map<string, { indice: number; dolar: number }>();
  for (const s of series) {
    seriesMap.set(claveMes(s.periodo.getUTCMonth() + 1, s.periodo.getUTCFullYear()), {
      indice: Number(s.indice),
      dolar: Number(s.dolar),
    });
  }

  function valorDeMes(mes: number, anio: number): ResultadoNominal | null {
    if (mes === periodoMes && anio === periodoAnio) return actual;
    return historicoMap.get(claveMes(mes, anio)) ?? null;
  }

  function acumular(
    desde: { mes: number; anio: number },
    hasta: { mes: number; anio: number },
    factorPorMes: (mes: number, anio: number) => number | null
  ): { total: ResultadoNominal; completo: boolean } {
    const total = vacio();
    let completo = true;
    for (const p of periodosDelRango(desde, hasta)) {
      const valores = valorDeMes(p.mes, p.anio);
      const factor = factorPorMes(p.mes, p.anio);
      if (!valores || factor === null) {
        completo = false;
        continue;
      }
      for (const c of CAMPOS) total[c] += valores[c] * factor;
    }
    return { total, completo };
  }

  function construirBloque(
    factorPorMes: (mes: number, anio: number) => number | null,
    etiqueta: string
  ): ResultadoBloque | null {
    const finAnterior = { mes: periodoMes, anio: periodoAnio - 1 };

    const factorActual = factorPorMes(periodoMes, periodoAnio);
    if (factorActual === null) {
      advertencias.push(
        `Falta el índice/dólar de ${claveMes(periodoMes, periodoAnio)} en Series e Índices — no se pudo armar el cuadro ${etiqueta}.`
      );
      return null;
    }
    const actualAjustado = vacio();
    for (const c of CAMPOS) actualAjustado[c] = actual[c] * factorActual;

    const valorAnterior = valorDeMes(finAnterior.mes, finAnterior.anio);
    const factorAnterior = factorPorMes(finAnterior.mes, finAnterior.anio);
    const mismoMesAnioAnteriorAjustado = vacio();
    if (!valorAnterior) {
      advertencias.push(
        `No hay datos en Resultados Históricos para ${claveMes(finAnterior.mes, finAnterior.anio)} (cuadro ${etiqueta}).`
      );
    } else if (factorAnterior === null) {
      advertencias.push(
        `Falta el índice/dólar de ${claveMes(finAnterior.mes, finAnterior.anio)} en Series e Índices (cuadro ${etiqueta}).`
      );
    } else {
      for (const c of CAMPOS) mismoMesAnioAnteriorAjustado[c] = valorAnterior[c] * factorAnterior;
    }

    const { total: acumActual, completo: completoActual } = acumular(
      inicioEjercicio(periodoMes, periodoAnio),
      { mes: periodoMes, anio: periodoAnio },
      factorPorMes
    );
    if (!completoActual) {
      advertencias.push(
        `Faltan períodos para completar el ejercicio actual en el cuadro ${etiqueta}.`
      );
    }

    const { total: acumAnterior, completo: completoAnterior } = acumular(
      inicioEjercicio(finAnterior.mes, finAnterior.anio),
      finAnterior,
      factorPorMes
    );
    if (!completoAnterior) {
      advertencias.push(
        `Faltan períodos para completar el ejercicio anterior en el cuadro ${etiqueta}.`
      );
    }

    const nMeses = mesesTranscurridosEnEjercicio(periodoMes);
    const promedio = vacio();
    for (const c of CAMPOS) promedio[c] = acumActual[c] / nMeses;

    return {
      actual: derivar(actualAjustado),
      mismoMesAnioAnterior: derivar(mismoMesAnioAnteriorAjustado),
      acumuladoActual: derivar(acumActual),
      acumuladoAnterior: derivar(acumAnterior),
      promedio: derivar(promedio),
      mesesTranscurridos: nMeses,
    };
  }

  const nominal = construirBloque(() => 1, "Nominal en Pesos")!;

  const ajustadoPorInflacion = construirBloque((mes, anio) => {
    const indiceInforme = seriesMap.get(claveMes(periodoMes, periodoAnio))?.indice;
    const indiceMes = seriesMap.get(claveMes(mes, anio))?.indice;
    if (indiceInforme === undefined || indiceMes === undefined) return null;
    return indiceInforme / indiceMes;
  }, "Ajustado por Inflación");

  const usd = construirBloque((mes, anio) => {
    const dolarMes = seriesMap.get(claveMes(mes, anio))?.dolar;
    return dolarMes ? 1 / dolarMes : null;
  }, "USD");

  return {
    informeId: informe.id,
    empresaId,
    empresaNombre: informe.empresa.nombreEmp,
    periodoMes,
    periodoAnio,
    nominal,
    ajustadoPorInflacion,
    usd,
    advertencias,
  };
}
