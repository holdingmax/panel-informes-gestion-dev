import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { normalizeCuenta } from "@/lib/cuenta-normalize";
import type { ResultadoNominal, DetalleSubrubroCuenta } from "@/lib/resultado-nominal";

// La acumulación cuenta por cuenta (rubroMap/nofMap, potencialmente cientos
// de filas de BSyS por rubro) se hace con Prisma.Decimal en vez de number,
// para no arrastrar el error de redondeo binario de sumar/restar muchos
// Decimal(18,2). Se convierte a number (redondeado a 2 decimales) recién al
// armar cada RubroLine — el resto del informe (totales, ESP, OyAF, NOF) ya
// opera sobre esas líneas "de presentación".
function round2(d: Prisma.Decimal): number {
  return d.toDecimalPlaces(2).toNumber();
}

function sumDecimal(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((a, b) => a.plus(b), new Prisma.Decimal(0));
}

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
  // naturalmente negativo. El Estado Patrimonial (hoja 2) muestra una versión
  // transformada de estos valores para exposición (ver `paraExposicionESP`) —
  // acá siempre quedan los crudos, para no alterar ningún otro cálculo
  // (OyAF, NOF) que depende de ellos.
  saldoInicio: number;
  saldoFinal: number;
  // Mismo valor que `origenAplicacion` (columna "Origen (Aplicación)" del
  // Estado Patrimonial, hoja 2) — se mantiene como campo aparte por si el
  // día de mañana alguna hoja necesita mostrar una de las dos sin la otra.
  variacion: number;
  // Columna del Estado de Origen y Aplicación de Fondos: positivo = Origen
  // de Fondos, negativo = Aplicación de Fondos, calculado siempre como
  // saldoInicio - saldoFinal (mismo signo natural para Activo, Pasivo y
  // Patrimonio Neto — ver comentario en `origenAplicacionDe`). La
  // clasificación Origen/Aplicación/Ajuste del Rubro (Configuración → Rubro)
  // sigue decidiendo en qué LISTA aparece (Orígenes, Aplicaciones o Ajustes
  // Ejercicios Anteriores) — no el signo, que ahora es siempre mecánico.
  origenAplicacion: number;
  // Default de NOF a nivel Rubro (atajo CTO/ONP/ARS del ESP) — null en la
  // línea sintética "Resultado del período" (codRubro -1, no es un Rubro real).
  bucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO" | null;
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
  bucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO" | null;
  orden: number | null;
  tipoPartida: "ACTIVO" | "PASIVO" | "PATRIMONIO_NETO" | "RESULTADO" | null;
  // Si la Partida tiene un Tipo asignado, aunque ese Tipo no tenga rol (p.
  // ej. Cuenta de Orden): distingue "sin clasificar todavía" (advertencia
  // de siempre) de "clasificado a propósito como fuera del Balance".
  tieneTipo: boolean;
  exigeSaldoCero: boolean;
  saldoInicio: Prisma.Decimal;
  saldoFinal: Prisma.Decimal;
};

type NofAgg = {
  codRubro: number;
  nomRubro: string;
  bucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO";
  saldoInicio: Prisma.Decimal;
  saldoFinal: Prisma.Decimal;
};

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

// Origen de Fondos = siempre positivo, Aplicación = siempre negativo — con
// una sola fórmula cruda (Debe-Haber) para Activo, Pasivo y Patrimonio
// Neto por igual. No es una coincidencia: por el signo natural de cada
// tipo (Activo débito-normal, Pasivo/PN crédito-normal), "el saldo bajó en
// crudo" significa exactamente "el Activo se achicó" o "la deuda/el
// patrimonio creció en términos absolutos" — las dos son, en la práctica
// contable, una fuente de fondos. Verificado contra datos reales que el
// Total de Orígenes sigue cerrando igual al Total de Aplicaciones.
// La clasificación Origen/Aplicación/Ajuste del Rubro sigue decidiendo en
// qué LISTA entra cada rubro (ver el loop que arma
// origenes/aplicaciones/ajustes más abajo) — lo único que cambia acá es el
// signo mostrado.
function origenAplicacionDe(saldoInicio: Prisma.Decimal, saldoFinal: Prisma.Decimal): Prisma.Decimal {
  return saldoInicio.minus(saldoFinal);
}

function toLine(r: RubroAgg): RubroLine {
  const origenAplicacion = round2(origenAplicacionDe(r.saldoInicio, r.saldoFinal));
  return {
    codRubro: r.codRubro,
    nombre: r.nomRubro,
    saldoInicio: round2(r.saldoInicio),
    saldoFinal: round2(r.saldoFinal),
    variacion: origenAplicacion,
    origenAplicacion,
    bucketNOF: r.bucketNOF,
  };
}

// Estado de Situación Patrimonial (hoja 2): Activo y Pasivo se muestran
// siempre en positivo; Patrimonio Neto puede mostrar positivo (saldo al
// Haber, el crudo negativo) o negativo (saldo al Debe, el crudo positivo).
// Se transforma con un cambio de signo por TIPO (Activo tal cual, Pasivo y
// Patrimonio Neto dados vuelta) — no con un valor absoluto por línea:
// usar Math.abs() por línea rompe la suma cuando una cuenta puntual tiene
// el signo crudo atípico para su tipo (p. ej. un Pasivo con saldo deudor
// en un período puntual), porque cada línea se invertiría de forma
// distinta. El cambio de signo uniforme por tipo, en cambio, preserva
// siempre la identidad de partida doble (Activo = Pasivo + Patrimonio
// Neto), sea cual sea el signo de cada cuenta individual — verificado
// contra datos reales. Se aplica solo acá, sobre una copia de las líneas:
// el resto del informe (OyAF, NOF) sigue usando los valores crudos.
function paraExposicionESP(
  lineas: RubroLine[],
  tipo: "ACTIVO" | "PASIVO" | "PATRIMONIO_NETO"
): RubroLine[] {
  const factor = tipo === "ACTIVO" ? 1 : -1;
  return lineas.map((l) => ({
    ...l,
    saldoInicio: factor * l.saldoInicio,
    saldoFinal: factor * l.saldoFinal,
  }));
}

// La hoja de NOF es el mismo Estado de Origen y Aplicación de Fondos,
// reagrupado por CTO/ONP/ARS en vez de por Origen/Aplicación/Ajuste — tiene
// que respetar exactamente el mismo signo que la hoja 4 (positivo =
// Origen, negativo = Aplicación) para que sea consistente y el Control
// cierre en cero. Por eso usa la misma fórmula que `toLine`.
function nofLine(r: NofAgg): RubroLine {
  const origenAplicacion = round2(origenAplicacionDe(r.saldoInicio, r.saldoFinal));
  return {
    codRubro: r.codRubro,
    nombre: r.nomRubro,
    saldoInicio: round2(r.saldoInicio),
    saldoFinal: round2(r.saldoFinal),
    variacion: origenAplicacion,
    origenAplicacion,
    bucketNOF: r.bucketNOF,
  };
}

export type CuentaSaldoInput = {
  cuenta: string;
  saldoIniDebe: number;
  saldoIniHaber: number;
  saldoCierreDebe: number;
  saldoCierreHaber: number;
};

export type PlanCuentaInput = {
  cuenta: string;
  rubroId: number;
  nomRubro: string;
  rubroBucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO" | null;
  rubroOrden: number | null;
  tipoRol: "ACTIVO" | "PASIVO" | "PATRIMONIO_NETO" | "RESULTADO" | null;
  tieneTipo: boolean;
  exigeSaldoCero: boolean;
  categoriaOyAId: number | null;
  categoriaOyABucketNOF: "OPERATIVO" | "NO_OPERATIVO" | "FINANCIAMIENTO" | null;
};

export type EmpresaBalanceInput = {
  nombreEmp: string;
  // false = no había ningún BSyS Acumulado cargado para el período pedido
  // (distinto de "tenía Acumulado pero 0 cuentas", que no debería pasar en
  // la práctica pero no genera la misma advertencia).
  tieneAcumulado: boolean;
  balances: CuentaSaldoInput[];
  planDeCuentas: PlanCuentaInput[];
};

export type InformeReportCore = Omit<
  InformeReport,
  "informeId" | "unidadNegocioId" | "unidadNegocioNombre" | "estado" | "fechaCargaAcumulado"
>;

// Lo que se congela al aprobar un informe (avanzarEstadoInforme) — una sola
// vez, nunca más se vuelve a tocar. `esp` es literalmente el input de
// buildInformeReport, así que releerlo después usa el mismo código de
// cálculo sin duplicar lógica. `erActual` guarda el resultado nominal del
// período ya calculado más el detalle por cuenta (para el "ojo" del ER) —
// las columnas de comparación del ER siguen leyendo ResultadosHistoricos,
// que ya es inmutable por diseño y no necesita congelarse de nuevo acá.
export type InformeSnapshot = {
  esp: {
    periodo: { periodoMes: number; periodoAnio: number };
    fechaCargaAcumulado: string | null;
    empresas: EmpresaBalanceInput[];
  };
  erActual: {
    valores: ResultadoNominal;
    cuentas: DetalleSubrubroCuenta[];
  };
};

// Función pura: sin Prisma ni ninguna otra dependencia externa, para poder
// testearla con datos armados a mano. computeInformeReport (más abajo) solo
// se encarga de leer de la base y traducir esas filas a los tipos de acá.
export function buildInformeReport(
  periodo: { periodoMes: number; periodoAnio: number },
  empresas: EmpresaBalanceInput[]
): InformeReportCore {
  const advertencias: string[] = [];

  // Una Unidad de Negocio puede combinar el Plan de Cuentas y el BSyS de
  // varias Empresas: se consolida sumando, rubro por rubro, la carga
  // ACUMULADO más reciente de cada una — cada Empresa avanza a su propio
  // ritmo, así que no se exige que compartan la misma fechaCarga exacta.
  if (empresas.length === 0) {
    advertencias.push("Esta unidad de negocio no tiene empresas vinculadas.");
  }

  const rubroMap = new Map<number, RubroAgg>();
  // Clasificado por cuenta (no por Rubro): dos cuentas de un mismo Rubro
  // pueden caer en buckets de NOF distintos, así que se agrupa por la
  // combinación Rubro + Categoría OyA.
  const nofMap = new Map<string, NofAgg>();

  for (const empresa of empresas) {
    if (!empresa.tieneAcumulado) {
      advertencias.push(
        `No hay BSyS Acumulado cargado para "${empresa.nombreEmp}" en el período ${formatPeriodoAbrev(periodo.periodoMes, periodo.periodoAnio)}.`
      );
      continue;
    }

    const porCuenta = new Map(empresa.planDeCuentas.map((p) => [normalizeCuenta(p.cuenta), p]));

    for (const b of empresa.balances) {
      const plan = porCuenta.get(normalizeCuenta(b.cuenta));
      if (!plan) {
        advertencias.push(
          `La cuenta "${b.cuenta}" (${empresa.nombreEmp}) no está clasificada en el Plan de Cuentas actual y se excluyó del informe.`
        );
        continue;
      }

      // Decimal (no number) desde el primer momento: esta suma corre sobre
      // potencialmente cientos de cuentas por rubro, es donde más importa
      // no arrastrar error de redondeo binario.
      const debeHaber = new Prisma.Decimal(b.saldoIniDebe).minus(b.saldoIniHaber);
      const debeHaberFinal = new Prisma.Decimal(b.saldoCierreDebe).minus(b.saldoCierreHaber);

      let agg = rubroMap.get(plan.rubroId);
      if (!agg) {
        agg = {
          codRubro: plan.rubroId,
          nomRubro: plan.nomRubro,
          bucketNOF: plan.rubroBucketNOF,
          orden: plan.rubroOrden,
          tipoPartida: plan.tipoRol,
          tieneTipo: plan.tieneTipo,
          exigeSaldoCero: plan.exigeSaldoCero,
          saldoInicio: new Prisma.Decimal(0),
          saldoFinal: new Prisma.Decimal(0),
        };
        rubroMap.set(plan.rubroId, agg);
      }
      agg.saldoInicio = agg.saldoInicio.plus(debeHaber);
      agg.saldoFinal = agg.saldoFinal.plus(debeHaberFinal);

      // La clasificación fina por cuenta (Configuración → Categoría OyA)
      // gana si está seteada; si no, cae al default a nivel Rubro (atajo
      // CTO/ONP/ARS cargado directo desde el ESP).
      const bucketNOF = plan.categoriaOyABucketNOF ?? plan.rubroBucketNOF;
      if (bucketNOF) {
        const key = `${plan.rubroId}:${plan.categoriaOyAId}`;
        let nofAgg = nofMap.get(key);
        if (!nofAgg) {
          nofAgg = {
            codRubro: plan.rubroId,
            nomRubro: plan.nomRubro,
            bucketNOF,
            saldoInicio: new Prisma.Decimal(0),
            saldoFinal: new Prisma.Decimal(0),
          };
          nofMap.set(key, nofAgg);
        }
        nofAgg.saldoInicio = nofAgg.saldoInicio.plus(debeHaber);
        nofAgg.saldoFinal = nofAgg.saldoFinal.plus(debeHaberFinal);
      }
    }
  }

  const rubros = [...rubroMap.values()];

  const EPSILON_SALDO_CERO = new Prisma.Decimal(0.01);
  for (const r of rubros) {
    if (r.tipoPartida) continue;

    if (!r.tieneTipo) {
      advertencias.push(
        `El rubro "${r.nomRubro}" no tiene Partida (Activo/Pasivo/Patrimonio Neto/Resultado) clasificada — se excluyó del informe. Clasificala en Configuración → Partida Patrimonial.`
      );
    } else if (r.exigeSaldoCero) {
      // Partidas como "Cuenta de Orden" quedan fuera del Balance a propósito
      // porque siempre deben netear a cero — si no es así, es una señal real
      // de que algo quedó mal cargado, no un caso a ignorar en silencio.
      if (r.saldoFinal.abs().greaterThan(EPSILON_SALDO_CERO)) {
        advertencias.push(
          `El rubro "${r.nomRubro}" es de un Tipo que exige saldo cero (ej. Cuenta de Orden) pero tiene un saldo final de ${round2(r.saldoFinal).toLocaleString("es-AR")} — revisar la carga.`
        );
      }
      if (r.saldoInicio.abs().greaterThan(EPSILON_SALDO_CERO)) {
        advertencias.push(
          `El rubro "${r.nomRubro}" es de un Tipo que exige saldo cero (ej. Cuenta de Orden) pero tiene un saldo de inicio de ${round2(r.saldoInicio).toLocaleString("es-AR")} — revisar la carga.`
        );
      }
    }
  }

  // Orden de exposición del ESP (Configuración → Rubro → Orden): de menor a
  // mayor, con los rubros sin orden asignado al final en el orden en que se
  // insertaron. Solo afecta el orden visual del Balance — el resto del
  // informe no depende de esto.
  function porOrdenDeExposicion(a: RubroAgg, b: RubroAgg): number {
    if (a.orden !== null && b.orden !== null) return a.orden - b.orden;
    if (a.orden !== null) return -1;
    if (b.orden !== null) return 1;
    return a.codRubro - b.codRubro;
  }

  const activoRubros = rubros.filter((r) => r.tipoPartida === "ACTIVO").sort(porOrdenDeExposicion);
  const pasivoRubros = rubros.filter((r) => r.tipoPartida === "PASIVO").sort(porOrdenDeExposicion);
  const patrimonioNetoRubros = rubros
    .filter((r) => r.tipoPartida === "PATRIMONIO_NETO")
    .sort(porOrdenDeExposicion);
  const resultadoRubros = rubros.filter((r) => r.tipoPartida === "RESULTADO");
  const balanceRubros = [...activoRubros, ...pasivoRubros, ...patrimonioNetoRubros];

  // Crudo (Debe - Haber), sin convertir a exposición: se usa tal cual para
  // armar la línea "Resultado del período" del Estado Patrimonial (hoja 2),
  // que se expone junto con el resto de Patrimonio Neto vía
  // paraExposicionESP más abajo.
  const resultadoDelPeriodoRawDec = sumDecimal(resultadoRubros.map((r) => r.saldoFinal));
  const resultadoDelPeriodoAnteriorRawDec = sumDecimal(resultadoRubros.map((r) => r.saldoInicio));

  const rdoPeriodoLine: RubroLine = {
    codRubro: -1,
    nombre: "Resultado del período",
    saldoInicio: round2(resultadoDelPeriodoAnteriorRawDec),
    saldoFinal: round2(resultadoDelPeriodoRawDec),
    variacion: round2(origenAplicacionDe(resultadoDelPeriodoAnteriorRawDec, resultadoDelPeriodoRawDec)),
    origenAplicacion: round2(
      origenAplicacionDe(resultadoDelPeriodoAnteriorRawDec, resultadoDelPeriodoRawDec)
    ),
    bucketNOF: null,
  };

  // Para el Estado de Origen y Aplicación de Fondos (hojas 4 y 5): el
  // Resultado del período es una partida más, de saldo crédito-normal igual
  // que Pasivo y Patrimonio Neto — es Origen cuando el saldo final (en
  // exposición, no crudo) es mayor que el inicial, lo que suele darse porque
  // el saldo inicial de Resultado debe ser cero por la refundición de
  // cuenta. Mostrar el crudo tal cual (como se hacía antes) hace que una
  // ganancia se lea negativa, exactamente al revés de lo que corresponde.
  const resultadoDelPeriodo = round2(resultadoDelPeriodoRawDec.negated());

  // Si las cuentas de Resultado (Ingresos/Egresos) de este BSyS Acumulado no
  // arrancan en cero — el "saldo inicio" del archivo no coincide con el
  // comienzo real del ejercicio — esas cuentas ya traían una porción de
  // resultado generada antes del período que cubre este informe. Junto con
  // la línea de arriba, esto explica el movimiento completo de Resultado
  // (Ri - Rf, el mismo criterio mecánico que el resto de esta hoja) sin
  // volver a contar esa porción dos veces. En una empresa donde el
  // Acumulado sí arranca en cero, este valor da 0 y no se muestra ninguna
  // línea.
  const resultadoInicioNoDistribuido = round2(resultadoDelPeriodoAnteriorRawDec);
  // No se usa para ninguna línea del informe (queda por simetría de tipo) —
  // mismo signo invertido que `resultadoDelPeriodo`.
  const resultadoDelPeriodoAnterior = round2(resultadoDelPeriodoAnteriorRawDec.negated());

  const activo = paraExposicionESP(activoRubros.map(toLine), "ACTIVO");
  const pasivo = paraExposicionESP(pasivoRubros.map(toLine), "PASIVO");
  const patrimonioNeto = paraExposicionESP(
    [...patrimonioNetoRubros.map(toLine), rdoPeriodoLine],
    "PATRIMONIO_NETO"
  );

  const totalActivo = sum(activo.map((l) => l.saldoFinal));
  const totalActivoAnterior = sum(activo.map((l) => l.saldoInicio));
  const totalPasivo = sum(pasivo.map((l) => l.saldoFinal));
  const totalPasivoAnterior = sum(pasivo.map((l) => l.saldoInicio));
  const totalPatrimonioNeto = sum(patrimonioNeto.map((l) => l.saldoFinal));
  const totalPatrimonioNetoAnterior = sum(patrimonioNeto.map((l) => l.saldoInicio));

  // Con Activo y Pasivo ya expuestos en positivo y Patrimonio Neto con el
  // signo dado vuelta, la identidad de partida doble pasa de "suman cero"
  // a la ecuación contable clásica: Activo = Pasivo + Patrimonio Neto.
  const control = totalActivo - (totalPasivo + totalPatrimonioNeto);
  const controlAnterior = totalActivoAnterior - (totalPasivoAnterior + totalPatrimonioNetoAnterior);

  // La lista en la que entra cada rubro (Orígenes o Aplicaciones) se
  // determina por el signo mecánico de `origenAplicacion` — así se cumple
  // la regla del usuario de que todo lo que aparece en Orígenes sea siempre
  // positivo y todo lo de Aplicaciones siempre negativo.
  const origenes: RubroLine[] = [];
  const aplicaciones: RubroLine[] = [];
  for (const r of balanceRubros) {
    const line = toLine(r);
    if (line.origenAplicacion >= 0) origenes.push(line);
    else aplicaciones.push(line);
  }

  // "Resultados Acumulados S/Indicadores" (el resultado del período) siempre
  // entra al total de Orígenes, sea cual sea su signo — es la convención
  // habitual de este estado: el resultado del ejercicio es la primera línea
  // de Orígenes, ya sea una ganancia o una pérdida.
  const totalOrigenes =
    sum(origenes.map((l) => l.origenAplicacion)) + resultadoDelPeriodo + resultadoInicioNoDistribuido;
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

  // "Resultados Acumulados S/Indicadores" es la misma información de la
  // hoja 4, mostrada de otro modo — no se recalcula acá. "Resultado vs NOF" =
  // eso más el Aumento (Disminución) de NOF; el control de abajo (Resultado
  // vs NOF + No operativas + Financiamiento) tiene que cerrar en 0, la misma
  // identidad de partida doble que ya usa el Control de la hoja 2, sólo que
  // reagrupada de otra forma.
  const resultadosAcumuladosSDifPatrimonial = resultadoDelPeriodo + resultadoInicioNoDistribuido;
  const resultadoVsNOF = resultadosAcumuladosSDifPatrimonial + totalOperativo;
  const controlNOF = resultadoVsNOF + totalNoOperativo + totalFinanciamiento;

  return {
    periodoMes: periodo.periodoMes,
    periodoAnio: periodo.periodoAnio,
    periodoLabel: formatPeriodoAbrev(periodo.periodoMes, periodo.periodoAnio),
    periodoAnteriorLabel: formatPeriodoAbrev(periodo.periodoMes, periodo.periodoAnio - 1),
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
    origenAplicacion: { origenes, aplicaciones, totalOrigenes, totalAplicaciones },
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

// Lee de la base (empresas vinculadas → última carga ACUMULADO de cada una
// dentro del período pedido → Plan de Cuentas) y arma el input exacto que
// espera buildInformeReport — ningún cálculo vive acá. Se usa tanto para
// leer un informe en vivo (computeInformeReport) como para armar el
// snapshot al aprobarlo (avanzarEstadoInforme, en informe-actions.ts).
export async function buildEmpresaBalanceInputs(
  unidadNegocioId: number,
  periodoMes: number,
  periodoAnio: number
): Promise<{ empresasInput: EmpresaBalanceInput[]; fechaCargaAcumulado: Date | null }> {
  const empresasDb = await prisma.empresa.findMany({ where: { unidadNegocioId } });

  let fechaCargaAcumulado: Date | null = null;
  const empresasInput: EmpresaBalanceInput[] = [];

  for (const empresa of empresasDb) {
    // Filtrado por el período del informe, no por "la carga más reciente
    // entre todas" — así el informe de un período ya cerrado no cambia si
    // después se carga un período posterior. fechaCarga desc solo
    // desempata dentro del propio período.
    const ultimoAcumulado = await prisma.balanceSumasYSaldos.findFirst({
      where: {
        empresaId: empresa.codEmp,
        tipo: "ACUMULADO",
        periodoMes,
        periodoAnio,
      },
      orderBy: { fechaCarga: "desc" },
      select: { fechaCarga: true },
    });

    if (!ultimoAcumulado) {
      empresasInput.push({
        nombreEmp: empresa.nombreEmp,
        tieneAcumulado: false,
        balances: [],
        planDeCuentas: [],
      });
      continue;
    }
    if (!fechaCargaAcumulado || ultimoAcumulado.fechaCarga > fechaCargaAcumulado) {
      fechaCargaAcumulado = ultimoAcumulado.fechaCarga;
    }

    const balances = await prisma.balanceSumasYSaldos.findMany({
      where: {
        empresaId: empresa.codEmp,
        tipo: "ACUMULADO",
        periodoMes,
        periodoAnio,
        fechaCarga: ultimoAcumulado.fechaCarga,
      },
    });

    const planDeCuentas = await prisma.planDeCuentas.findMany({
      where: { empresaId: empresa.codEmp },
      include: {
        rubro: { include: { partidaPatrimonial: { include: { tipo: true } } } },
        categoriaOyA: true,
      },
    });

    empresasInput.push({
      nombreEmp: empresa.nombreEmp,
      tieneAcumulado: true,
      balances: balances.map((b) => ({
        cuenta: b.cuenta,
        saldoIniDebe: Number(b.saldoIniDebe),
        saldoIniHaber: Number(b.saldoIniHaber),
        saldoCierreDebe: Number(b.saldoCierreDebe),
        saldoCierreHaber: Number(b.saldoCierreHaber),
      })),
      planDeCuentas: planDeCuentas.map((p) => ({
        cuenta: p.cuenta,
        rubroId: p.rubroId,
        nomRubro: p.rubro.nomRubro,
        rubroBucketNOF: p.rubro.bucketNOF,
        rubroOrden: p.rubro.orden,
        tipoRol: p.rubro.partidaPatrimonial?.tipo?.rol ?? null,
        tieneTipo: p.rubro.partidaPatrimonial?.tipo != null,
        exigeSaldoCero: p.rubro.partidaPatrimonial?.tipo?.exigeSaldoCero ?? false,
        categoriaOyAId: p.categoriaOyAId,
        categoriaOyABucketNOF: p.categoriaOyA?.bucketNOF ?? null,
      })),
    });
  }

  return { empresasInput, fechaCargaAcumulado };
}

// Lee de la base (empresas vinculadas → última carga ACUMULADO de cada una
// dentro del período del informe → Plan de Cuentas) y traduce esas filas a
// los tipos planos que espera buildInformeReport — ningún cálculo vive acá.
export async function computeInformeReport(informeId: string): Promise<InformeReport> {
  const informe = await prisma.informe.findUniqueOrThrow({
    where: { id: informeId },
    include: { unidadNegocio: true },
  });

  // Congelado (Aprobado/Definitivo): se recalcula con el mismo motor pero a
  // partir del snapshot guardado al aprobar, no contra el Plan de
  // Cuentas/BSyS actuales — así reclasificar una cuenta después no cambia
  // silenciosamente un informe ya cerrado.
  if (informe.snapshot) {
    const snapshot = informe.snapshot as unknown as InformeSnapshot;
    const core = buildInformeReport(snapshot.esp.periodo, snapshot.esp.empresas);
    return {
      informeId: informe.id,
      unidadNegocioId: informe.unidadNegocioId,
      unidadNegocioNombre: informe.unidadNegocio.nombreUnidad,
      estado: informe.estado,
      fechaCargaAcumulado: snapshot.esp.fechaCargaAcumulado
        ? new Date(snapshot.esp.fechaCargaAcumulado)
        : null,
      ...core,
    };
  }

  const { empresasInput, fechaCargaAcumulado } = await buildEmpresaBalanceInputs(
    informe.unidadNegocioId,
    informe.periodoMes,
    informe.periodoAnio
  );

  const core = buildInformeReport(
    { periodoMes: informe.periodoMes, periodoAnio: informe.periodoAnio },
    empresasInput
  );

  return {
    informeId: informe.id,
    unidadNegocioId: informe.unidadNegocioId,
    unidadNegocioNombre: informe.unidadNegocio.nombreUnidad,
    estado: informe.estado,
    fechaCargaAcumulado,
    ...core,
  };
}

export type DetalleRubroCuenta = {
  // null cuando el detalle sale de un snapshot congelado — ahí no hay botón
  // Editar, así que no hace falta el id real de PlanDeCuentas.
  planDeCuentaId: string | null;
  empresaNombre: string;
  cuenta: string;
  saldoInicio: number;
  saldoFinal: number;
  // Siempre igual al Rubro filtrado hoy (se muestra para habilitar el botón
  // Editar, que puede reclasificar la cuenta a otro Rubro).
  rubroId: number;
  nomRubro: string;
};

export type DetalleRubro = {
  codRubro: number;
  nomRubro: string;
  // El informe ya no se puede editar: no se muestra el botón Editar aunque
  // el llamador se olvide de chequearlo.
  congelado: boolean;
  cuentas: DetalleRubroCuenta[];
  totalSaldoInicio: number;
  totalSaldoFinal: number;
};

// Mismo cambio de signo por tipo que usa paraExposicionESP (no un valor
// absoluto por cuenta) para que la suma de este detalle coincida siempre
// con la fila resumen del ESP.
function exponerSegunTipo(
  tipoPartida: "ACTIVO" | "PASIVO" | "PATRIMONIO_NETO" | "RESULTADO" | null,
  v: number
): number {
  return tipoPartida === "ACTIVO" ? v : -v;
}

// Repite la misma consolidación de computeInformeReport (empresas
// vinculadas → última carga ACUMULADO de cada una), filtrada a un solo
// Rubro, para el drill-down "ojo" del ESP — cada cuenta ya viene con el
// mismo signo de exposición que su fila resumen, para que sumen igual. Si
// el informe está congelado, lee del snapshot en vez del Plan de Cuentas
// actual.
export async function getDetalleRubro(informeId: string, codRubro: number): Promise<DetalleRubro> {
  const informe = await prisma.informe.findUniqueOrThrow({ where: { id: informeId } });
  const rubro = await prisma.rubro.findUniqueOrThrow({ where: { codRubro } });

  if (informe.snapshot) {
    const snapshot = informe.snapshot as unknown as InformeSnapshot;
    let tipoPartida: "ACTIVO" | "PASIVO" | "PATRIMONIO_NETO" | "RESULTADO" | null = null;
    const cuentas: DetalleRubroCuenta[] = [];

    for (const empresa of snapshot.esp.empresas) {
      const porCuenta = new Map(empresa.planDeCuentas.map((p) => [normalizeCuenta(p.cuenta), p]));
      for (const b of empresa.balances) {
        const plan = porCuenta.get(normalizeCuenta(b.cuenta));
        if (!plan || plan.rubroId !== codRubro) continue;
        if (!tipoPartida) tipoPartida = plan.tipoRol;

        cuentas.push({
          planDeCuentaId: null,
          empresaNombre: empresa.nombreEmp,
          cuenta: b.cuenta,
          saldoInicio: exponerSegunTipo(
            tipoPartida,
            round2(new Prisma.Decimal(b.saldoIniDebe).minus(b.saldoIniHaber))
          ),
          saldoFinal: exponerSegunTipo(
            tipoPartida,
            round2(new Prisma.Decimal(b.saldoCierreDebe).minus(b.saldoCierreHaber))
          ),
          rubroId: plan.rubroId,
          nomRubro: plan.nomRubro,
        });
      }
    }

    return {
      codRubro,
      nomRubro: rubro.nomRubro,
      congelado: true,
      cuentas,
      totalSaldoInicio: sum(cuentas.map((c) => c.saldoInicio)),
      totalSaldoFinal: sum(cuentas.map((c) => c.saldoFinal)),
    };
  }

  const empresas = await prisma.empresa.findMany({ where: { unidadNegocioId: informe.unidadNegocioId } });

  const cuentas: DetalleRubroCuenta[] = [];
  let tipoPartida: "ACTIVO" | "PASIVO" | "PATRIMONIO_NETO" | "RESULTADO" | null = null;

  for (const empresa of empresas) {
    const ultimoAcumulado = await prisma.balanceSumasYSaldos.findFirst({
      where: {
        empresaId: empresa.codEmp,
        tipo: "ACUMULADO",
        periodoMes: informe.periodoMes,
        periodoAnio: informe.periodoAnio,
      },
      orderBy: { fechaCarga: "desc" },
      select: { fechaCarga: true },
    });
    if (!ultimoAcumulado) continue;

    const planDeCuentas = await prisma.planDeCuentas.findMany({
      where: { empresaId: empresa.codEmp, rubroId: codRubro },
      include: { rubro: { include: { partidaPatrimonial: { include: { tipo: true } } } } },
    });
    if (planDeCuentas.length === 0) continue;
    const porCuenta = new Map(planDeCuentas.map((p) => [normalizeCuenta(p.cuenta), p]));

    const balances = await prisma.balanceSumasYSaldos.findMany({
      where: {
        empresaId: empresa.codEmp,
        tipo: "ACUMULADO",
        periodoMes: informe.periodoMes,
        periodoAnio: informe.periodoAnio,
        fechaCarga: ultimoAcumulado.fechaCarga,
      },
    });

    for (const b of balances) {
      const plan = porCuenta.get(normalizeCuenta(b.cuenta));
      if (!plan) continue;
      if (!tipoPartida) tipoPartida = plan.rubro.partidaPatrimonial?.tipo?.rol ?? null;

      cuentas.push({
        planDeCuentaId: plan.id,
        empresaNombre: empresa.nombreEmp,
        cuenta: b.cuenta,
        saldoInicio: round2(new Prisma.Decimal(b.saldoIniDebe).minus(b.saldoIniHaber)),
        saldoFinal: round2(new Prisma.Decimal(b.saldoCierreDebe).minus(b.saldoCierreHaber)),
        rubroId: plan.rubroId,
        nomRubro: plan.rubro.nomRubro,
      });
    }
  }

  const cuentasExpuestas = cuentas.map((c) => ({
    ...c,
    saldoInicio: exponerSegunTipo(tipoPartida, c.saldoInicio),
    saldoFinal: exponerSegunTipo(tipoPartida, c.saldoFinal),
  }));

  return {
    codRubro,
    nomRubro: rubro.nomRubro,
    congelado: false,
    cuentas: cuentasExpuestas,
    totalSaldoInicio: sum(cuentasExpuestas.map((c) => c.saldoInicio)),
    totalSaldoFinal: sum(cuentasExpuestas.map((c) => c.saldoFinal)),
  };
}
