import { describe, expect, it } from "vitest";
import {
  buildInformeReport,
  type CuentaSaldoInput,
  type EmpresaBalanceInput,
  type PlanCuentaInput,
} from "@/lib/balance-oya-report";

const PERIODO = { periodoMes: 6, periodoAnio: 2026 };

function saldo(
  cuenta: string,
  saldoIniDebe: number,
  saldoIniHaber: number,
  saldoCierreDebe: number,
  saldoCierreHaber: number
): CuentaSaldoInput {
  return { cuenta, saldoIniDebe, saldoIniHaber, saldoCierreDebe, saldoCierreHaber };
}

function plan(overrides: Partial<PlanCuentaInput> & Pick<PlanCuentaInput, "cuenta" | "rubroId" | "nomRubro" | "tipoRol">): PlanCuentaInput {
  return {
    rubroBucketNOF: null,
    rubroOrden: null,
    tieneTipo: true,
    exigeSaldoCero: false,
    categoriaOyAId: null,
    categoriaOyABucketNOF: null,
    ...overrides,
  };
}

function empresa(balances: CuentaSaldoInput[], planDeCuentas: PlanCuentaInput[]): EmpresaBalanceInput {
  return { nombreEmp: "Empresa Test", tieneAcumulado: true, balances, planDeCuentas };
}

describe("buildInformeReport — ESP", () => {
  it("Activo con saldo deudor: se expone positivo en el ESP", () => {
    const empresas = [
      empresa(
        [saldo("CAJA", 100, 0, 150, 0)],
        [plan({ cuenta: "CAJA", rubroId: 1, nomRubro: "Disponibilidades", tipoRol: "ACTIVO" })]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.balance.activo).toHaveLength(1);
    expect(report.balance.activo[0].saldoInicio).toBe(100);
    expect(report.balance.activo[0].saldoFinal).toBe(150);
  });

  it("Pasivo con saldo acreedor: se expone positivo en el ESP", () => {
    const empresas = [
      empresa(
        [saldo("PRESTAMO", 0, 200, 0, 250)],
        [plan({ cuenta: "PRESTAMO", rubroId: 2, nomRubro: "Deudas Financieras", tipoRol: "PASIVO" })]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.balance.pasivo).toHaveLength(1);
    // Crudo: inicio=-200, final=-250 (crédito-normal) — expuesto (factor -1)
    // ambos quedan positivos.
    expect(report.balance.pasivo[0].saldoInicio).toBe(200);
    expect(report.balance.pasivo[0].saldoFinal).toBe(250);
  });
});

describe("buildInformeReport — Estado de Origen y Aplicación de Fondos", () => {
  it("Aumento de Activo: se expone como Aplicación en OyAF", () => {
    const empresas = [
      empresa(
        [saldo("CAJA", 100, 0, 150, 0)],
        [plan({ cuenta: "CAJA", rubroId: 1, nomRubro: "Disponibilidades", tipoRol: "ACTIVO" })]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.origenAplicacion.aplicaciones).toHaveLength(1);
    expect(report.origenAplicacion.aplicaciones[0].origenAplicacion).toBe(-50);
    expect(report.origenAplicacion.origenes).toHaveLength(0);
  });

  it("Aumento de Pasivo: se expone como Origen en OyAF", () => {
    const empresas = [
      empresa(
        [saldo("PRESTAMO", 0, 200, 0, 250)],
        [plan({ cuenta: "PRESTAMO", rubroId: 2, nomRubro: "Deudas Financieras", tipoRol: "PASIVO" })]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.origenAplicacion.origenes).toHaveLength(1);
    expect(report.origenAplicacion.origenes[0].origenAplicacion).toBe(50);
    expect(report.origenAplicacion.aplicaciones).toHaveLength(0);
  });

  it('"Ajustes Ejercicios Anteriores" ya no es un caso especial: entra a Orígenes/Aplicaciones como cualquier Rubro de Patrimonio Neto', () => {
    const empresas = [
      empresa(
        [saldo("RESULTADOS ACUMULADOS", 0, 100, 0, 400)],
        [
          plan({
            cuenta: "RESULTADOS ACUMULADOS",
            rubroId: 3,
            nomRubro: "Resultados Acumulados",
            tipoRol: "PATRIMONIO_NETO",
          }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.origenAplicacion.origenes).toHaveLength(1);
    expect(report.origenAplicacion.origenes[0].nombre).toBe("Resultados Acumulados");
    expect(report.origenAplicacion.aplicaciones).toHaveLength(0);
  });

  it("Cuenta con Categoría OyA propia: prevalece sobre el bucketNOF del Rubro", () => {
    const empresas = [
      empresa(
        [saldo("CAJA", 100, 0, 150, 0)],
        [
          plan({
            cuenta: "CAJA",
            rubroId: 1,
            nomRubro: "Disponibilidades",
            tipoRol: "ACTIVO",
            rubroBucketNOF: "OPERATIVO",
            categoriaOyAId: 9,
            categoriaOyABucketNOF: "FINANCIAMIENTO",
          }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.nof.financiamiento).toHaveLength(1);
    expect(report.nof.operativo).toHaveLength(0);
  });
});

describe("buildInformeReport — Resultado del período", () => {
  it("coincide con la suma de las cuentas de Resultado", () => {
    const empresas = [
      empresa(
        [
          saldo("VENTAS", 0, 0, 0, 1000),
          saldo("COSTOS", 0, 0, 400, 0),
        ],
        [
          plan({ cuenta: "VENTAS", rubroId: 10, nomRubro: "Ventas", tipoRol: "RESULTADO" }),
          plan({ cuenta: "COSTOS", rubroId: 11, nomRubro: "Costos", tipoRol: "RESULTADO" }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    // Crudo: Ventas final=-1000, Costos final=+400 → suma=-600.
    // Expuesto (positivo=ganancia) = -(-600) = 600.
    expect(report.resultadoDelPeriodo).toBe(600);
  });
});

describe("buildInformeReport — advertencias", () => {
  it("Tipo con exigeSaldoCero y saldo distinto de cero: genera advertencia", () => {
    const empresas = [
      empresa(
        [saldo("CUENTA DE ORDEN", 0, 0, 50, 0)],
        [
          plan({
            cuenta: "CUENTA DE ORDEN",
            rubroId: 20,
            nomRubro: "Cuenta de Orden",
            tipoRol: null,
            tieneTipo: true,
            exigeSaldoCero: true,
          }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.advertencias.some((a) => a.includes("exige saldo cero"))).toBe(true);
  });

  it("Cuenta no clasificada en el Plan de Cuentas: genera advertencia", () => {
    const empresas = [empresa([saldo("CUENTA SIN CLASIFICAR", 0, 0, 100, 0)], [])];

    const report = buildInformeReport(PERIODO, empresas);

    expect(
      report.advertencias.some((a) => a.includes("no está clasificada en el Plan de Cuentas"))
    ).toBe(true);
  });
});

describe("buildInformeReport — control de partida doble", () => {
  it("ESP cuadrado: Activo = Pasivo + Patrimonio Neto", () => {
    const empresas = [
      empresa(
        [
          // Activo crudo: 500 -> 550 (+50)
          saldo("CAJA", 500, 0, 550, 0),
          // Pasivo crudo: -300 -> -300 (sin cambio)
          saldo("PRESTAMO", 0, 300, 0, 300),
          // Patrimonio Neto crudo: -200 -> -250 (más ganancia acumulada)
          saldo("CAPITAL", 0, 200, 0, 250),
        ],
        [
          plan({ cuenta: "CAJA", rubroId: 1, nomRubro: "Disponibilidades", tipoRol: "ACTIVO" }),
          plan({ cuenta: "PRESTAMO", rubroId: 2, nomRubro: "Deudas Financieras", tipoRol: "PASIVO" }),
          plan({ cuenta: "CAPITAL", rubroId: 3, nomRubro: "Capital Social", tipoRol: "PATRIMONIO_NETO" }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.balance.control).toBeCloseTo(0, 8);
    expect(report.balance.totalActivo).toBeCloseTo(
      report.balance.totalPasivo + report.balance.totalPatrimonioNeto,
      8
    );
  });
});
