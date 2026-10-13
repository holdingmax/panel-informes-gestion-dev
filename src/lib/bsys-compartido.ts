import { prisma } from "@/lib/prisma";
import { normalizeCuenta } from "@/lib/cuenta-normalize";

// Una Empresa con comparteBsys = true está en varias Unidades de Negocio y
// cada una carga su propio BSyS (Mes y Acumulado) de ese período: tienen que
// ser idénticos. Este módulo compara esas cargas — sin "use server", se llama
// desde server actions (importación de BSyS y aprobación del informe).

type TipoBsys = "MES" | "ACUMULADO";
type Saldos = [number, number, number, number, number, number];

const TIPO_LABEL: Record<TipoBsys, string> = { MES: "Mes", ACUMULADO: "Acumulado" };
const TOLERANCIA = 0.005;
const MAX_CUENTAS_EN_MENSAJE = 3;

// La carga más reciente de este período de esa Unidad, agrupada por cuenta
// (normalizada). Null = esa Unidad no cargó ese BSyS.
async function cargarBsys(
  empresaId: number,
  unidadNegocioId: number,
  tipo: TipoBsys,
  periodoMes: number,
  periodoAnio: number
): Promise<Map<string, { cuenta: string; saldos: Saldos }> | null> {
  const donde = { empresaId, unidadNegocioId, tipo, periodoMes, periodoAnio };
  const ultima = await prisma.balanceSumasYSaldos.findFirst({
    where: donde,
    orderBy: { fechaCarga: "desc" },
    select: { fechaCarga: true },
  });
  if (!ultima) return null;

  const filas = await prisma.balanceSumasYSaldos.findMany({
    where: { ...donde, fechaCarga: ultima.fechaCarga },
  });
  const mapa = new Map<string, { cuenta: string; saldos: Saldos }>();
  for (const f of filas) {
    const clave = normalizeCuenta(f.cuenta);
    const actual = mapa.get(clave) ?? { cuenta: f.cuenta, saldos: [0, 0, 0, 0, 0, 0] as Saldos };
    const valores = [f.saldoIniDebe, f.saldoIniHaber, f.sumasDebe, f.sumasHaber, f.saldoCierreDebe, f.saldoCierreHaber];
    valores.forEach((v, i) => (actual.saldos[i] += Number(v)));
    mapa.set(clave, actual);
  }
  return mapa;
}

// Cuentas que no coinciden entre las dos cargas (están en una sola, o con
// algún saldo distinto).
function cuentasDistintas(
  a: Map<string, { cuenta: string; saldos: Saldos }>,
  b: Map<string, { cuenta: string; saldos: Saldos }>
): string[] {
  const distintas: string[] = [];
  for (const [clave, x] of a) {
    const y = b.get(clave);
    if (!y || x.saldos.some((v, i) => Math.abs(v - y.saldos[i]) > TOLERANCIA)) {
      distintas.push(x.cuenta);
    }
  }
  for (const [clave, y] of b) {
    if (!a.has(clave)) distintas.push(y.cuenta);
  }
  return distintas;
}

type FilaNueva = {
  cuenta: string;
  saldoIniDebe: number;
  saldoIniHaber: number;
  sumasDebe: number;
  sumasHaber: number;
  saldoCierreDebe: number;
  saldoCierreHaber: number;
};

// Antes de guardar una carga nueva: compara las filas que se van a guardar con
// el BSyS (mismo tipo y período) que ya cargó cada una de las otras Unidades
// que comparten la Empresa. Devuelve un mensaje si no coinciden con alguna —
// la carga se rechaza — o null si coinciden o si ninguna cargó todavía.
export async function motivoRechazoCargaCompartida(
  empresaId: number,
  empresaNombre: string,
  unidadNegocioId: number,
  tipo: TipoBsys,
  filas: FilaNueva[],
  periodoMes: number,
  periodoAnio: number
): Promise<string | null> {
  const otras = await prisma.empresaUnidad.findMany({
    where: { empresaId, unidadNegocioId: { not: unidadNegocioId } },
    select: { unidadNegocio: { select: { codUnidad: true, nombreUnidad: true } } },
  });
  if (otras.length === 0) return null;

  const nuevas = new Map<string, { cuenta: string; saldos: Saldos }>();
  for (const f of filas) {
    const clave = normalizeCuenta(f.cuenta);
    const actual = nuevas.get(clave) ?? { cuenta: f.cuenta, saldos: [0, 0, 0, 0, 0, 0] as Saldos };
    [f.saldoIniDebe, f.saldoIniHaber, f.sumasDebe, f.sumasHaber, f.saldoCierreDebe, f.saldoCierreHaber].forEach(
      (v, i) => (actual.saldos[i] += Number(v))
    );
    nuevas.set(clave, actual);
  }

  for (const { unidadNegocio } of otras) {
    const ajena = await cargarBsys(empresaId, unidadNegocio.codUnidad, tipo, periodoMes, periodoAnio);
    if (!ajena) continue;
    const distintas = cuentasDistintas(nuevas, ajena);
    if (distintas.length > 0) {
      const ejemplo = distintas.slice(0, MAX_CUENTAS_EN_MENSAJE).join(", ");
      const resto = distintas.length > MAX_CUENTAS_EN_MENSAJE ? " y otras" : "";
      return `El BSyS ${TIPO_LABEL[tipo]} de "${empresaNombre}" no coincide con el que ya cargó la unidad "${unidadNegocio.nombreUnidad}" para este período (${distintas.length} cuenta(s) distintas, por ejemplo ${ejemplo}${resto}). Se rechazó la carga: las unidades que comparten una empresa tienen que cargar el mismo BSyS. Corregí el archivo, o coordiná con esa unidad si el que está mal es el suyo.`;
    }
  }
  return null;
}

export type ResultadoBsysCompartido = {
  // Unidades que comparten alguna Empresa con ésta y todavía no tienen un
  // informe de ese período.
  sinInforme: string[];
  // Una Unidad con informe pero sin el BSyS (Mes o Acumulado) de una Empresa
  // compartida cargado.
  sinCarga: string[];
  // BSyS cargados por las dos Unidades que no coinciden.
  discrepancias: string[];
};

// Compara, para cada Empresa que esta Unidad comparte con otras, el BSyS que
// cargó esta Unidad con el de cada una de las otras. `soloEmpresaIds` limita
// la revisión a esas Empresas (al cargar, solo las que se acaban de subir).
export async function verificarBsysCompartido(
  unidadNegocioId: number,
  periodoMes: number,
  periodoAnio: number,
  soloEmpresaIds?: number[]
): Promise<ResultadoBsysCompartido> {
  const resultado: ResultadoBsysCompartido = { sinInforme: [], sinCarga: [], discrepancias: [] };

  const vinculos = await prisma.empresaUnidad.findMany({
    where: {
      unidadNegocioId,
      empresa: { comparteBsys: true },
      ...(soloEmpresaIds ? { empresaId: { in: soloEmpresaIds } } : {}),
    },
    select: {
      empresa: {
        select: {
          codEmp: true,
          nombreEmp: true,
          unidades: { select: { unidadNegocio: { select: { codUnidad: true, nombreUnidad: true } } } },
        },
      },
    },
  });
  if (vinculos.length === 0) return resultado;

  const propia = await prisma.unidadNegocio.findUniqueOrThrow({
    where: { codUnidad: unidadNegocioId },
    select: { nombreUnidad: true },
  });

  const unidadesSinInforme = new Set<string>();
  const informeEnUnidad = new Map<number, boolean>();

  for (const { empresa } of vinculos) {
    const otras = empresa.unidades
      .map((u) => u.unidadNegocio)
      .filter((u) => u.codUnidad !== unidadNegocioId);

    for (const otra of otras) {
      if (!informeEnUnidad.has(otra.codUnidad)) {
        const cantidad = await prisma.informe.count({
          where: { unidadNegocioId: otra.codUnidad, periodoMes, periodoAnio },
        });
        informeEnUnidad.set(otra.codUnidad, cantidad > 0);
      }
      if (!informeEnUnidad.get(otra.codUnidad)) {
        unidadesSinInforme.add(otra.nombreUnidad);
        continue;
      }

      for (const tipo of ["MES", "ACUMULADO"] as const) {
        const [propio, ajeno] = await Promise.all([
          cargarBsys(empresa.codEmp, unidadNegocioId, tipo, periodoMes, periodoAnio),
          cargarBsys(empresa.codEmp, otra.codUnidad, tipo, periodoMes, periodoAnio),
        ]);
        if (!propio) continue; // esta Unidad todavía no lo cargó: nada que comparar
        if (!ajeno) {
          resultado.sinCarga.push(
            `"${otra.nombreUnidad}" no cargó el BSyS ${TIPO_LABEL[tipo]} de "${empresa.nombreEmp}"`
          );
          continue;
        }
        const distintas = cuentasDistintas(propio, ajeno);
        if (distintas.length > 0) {
          const ejemplo = distintas.slice(0, MAX_CUENTAS_EN_MENSAJE).join(", ");
          const resto = distintas.length > MAX_CUENTAS_EN_MENSAJE ? " y otras" : "";
          resultado.discrepancias.push(
            `BSyS ${TIPO_LABEL[tipo]} de "${empresa.nombreEmp}": no coincide entre "${propia.nombreUnidad}" y "${otra.nombreUnidad}" (${distintas.length} cuenta(s) distintas, por ejemplo ${ejemplo}${resto})`
          );
        }
      }
    }
  }

  resultado.sinInforme = [...unidadesSinInforme];
  return resultado;
}

// Para frenar la aprobación: todo lo que impide aprobar, en un solo mensaje.
export function mensajeBloqueoAprobacion(r: ResultadoBsysCompartido): string | null {
  const partes: string[] = [];
  if (r.sinInforme.length > 0) {
    partes.push(
      `Todavía no tiene un informe de este período cargado: ${r.sinInforme.map((u) => `"${u}"`).join(", ")}. Comparte empresa con esta unidad y hace falta para poder aprobar.`
    );
  }
  if (r.sinCarga.length > 0) partes.push(`${r.sinCarga.join("; ")}.`);
  if (r.discrepancias.length > 0) {
    partes.push(`${r.discrepancias.join("; ")}. Resolvelo recargando el BSyS en la unidad que corresponda.`);
  }
  if (partes.length === 0) return null;
  return `No se puede aprobar: la empresa compartida no está al día entre unidades. ${partes.join(" ")}`;
}

// Una Empresa que comparte BSyS tiene un único Plan de Cuentas visible desde
// todas sus Unidades, y cada cuenta tiene que pertenecer a una de ellas ("Cuit
// compartido"). Si alguna cuenta no tiene unidad, o tiene una que ya no
// comparte la Empresa, el informe de cualquiera de las Unidades quedaría mal
// armado (esa cuenta se trataría como propia): se frena el proceso y se avisa.
// Devuelve el mensaje, o null si todo está en orden. `soloEmpresaIds` limita la
// revisión a esas Empresas.
export async function verificarPlanCompartido(
  unidadNegocioId: number,
  soloEmpresaIds?: number[]
): Promise<string | null> {
  const vinculos = await prisma.empresaUnidad.findMany({
    where: {
      unidadNegocioId,
      empresa: { comparteBsys: true },
      ...(soloEmpresaIds ? { empresaId: { in: soloEmpresaIds } } : {}),
    },
    select: {
      empresa: {
        select: { codEmp: true, nombreEmp: true, unidades: { select: { unidadNegocioId: true } } },
      },
    },
  });

  const problemas: string[] = [];
  for (const { empresa } of vinculos) {
    const vigentes = empresa.unidades.map((u) => u.unidadNegocioId);
    const cuentas = await prisma.planDeCuentas.findMany({
      where: {
        empresaId: empresa.codEmp,
        OR: [{ unidadNegocioId: null }, { unidadNegocioId: { notIn: vigentes } }],
      },
      select: { cuenta: true },
      orderBy: { cuenta: "asc" },
    });
    if (cuentas.length > 0) {
      const ejemplo = cuentas
        .slice(0, MAX_CUENTAS_EN_MENSAJE)
        .map((c) => c.cuenta)
        .join("; ");
      problemas.push(
        `"${empresa.nombreEmp}": ${cuentas.length} cuenta(s) sin una unidad válida en "Cuit compartido" (por ejemplo ${ejemplo}${cuentas.length > MAX_CUENTAS_EN_MENSAJE ? " y otras" : ""})`
      );
    }
  }
  if (problemas.length === 0) return null;
  return `El Plan de Cuentas de una empresa compartida está incompleto: ${problemas.join(". ")}. Asignales su unidad en Configuración → Plan de Cuentas (Editar) y volvé a intentar.`;
}
