import { describe, expect, it } from "vitest";
import {
  buildInformeReport,
  bucketNOFDeUnidad,
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
    id: "test-id",
    rubroBucketNOF: null,
    rubroOrden: null,
    tieneTipo: true,
    exigeSaldoCero: false,
    exposicionCambiante: false,
    unidadNegocioId: null,
    subrubroId: null,
    ...overrides,
  };
}

function empresa(
  balances: CuentaSaldoInput[],
  planDeCuentas: PlanCuentaInput[],
  extra: Partial<EmpresaBalanceInput> = {}
): EmpresaBalanceInput {
  return { nombreEmp: "Empresa Test", tieneAcumulado: true, balances, planDeCuentas, ...extra };
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

  it("El bucket de NOF sale siempre del selector CTO/ONP/ARS del Rubro", () => {
    const empresas = [
      empresa(
        [saldo("CAJA", 100, 0, 150, 0)],
        [
          plan({
            cuenta: "CAJA",
            rubroId: 1,
            nomRubro: "Disponibilidades",
            tipoRol: "ACTIVO",
            rubroBucketNOF: "FINANCIAMIENTO",
          }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.nof.financiamiento).toHaveLength(1);
    expect(report.nof.operativo).toHaveLength(0);
  });
});

describe("buildInformeReport — Empresa que comparte BSyS entre unidades", () => {
  // Unidad 1 ("Crear Construcciones") confecciona su informe; la Empresa la
  // comparte con la Unidad 2 ("Fredy Publicidad"). Las dos partes del BSyS
  // suman cero: lo que sobra de un lado es el Intercompany del otro.
  const compartida = {
    comparteBsys: true,
    unidadActualId: 1,
    unidadesNombres: { "1": "Crear Construcciones", "2": "Fredy Publicidad" },
  };

  function empresaCompartida(saldoOtraUnidad: number) {
    return empresa(
      [
        saldo("CAJA", 0, 0, 100, 0),
        saldo("PRESTAMO FREDY", 0, 0, 0, 40),
        saldo("VENTAS FREDY", 0, 0, 0, 60),
      ].map((b) => (b.cuenta === "VENTAS FREDY" ? { ...b, saldoCierreHaber: saldoOtraUnidad } : b)),
      [
        plan({
          cuenta: "CAJA",
          rubroId: 1,
          nomRubro: "Disponibilidades",
          tipoRol: "ACTIVO",
          rubroBucketNOF: "OPERATIVO",
          unidadNegocioId: 1,
        }),
        // Cuentas de la otra Unidad: su Rubro/Subrubro se ignoran.
        plan({
          cuenta: "PRESTAMO FREDY",
          rubroId: 2,
          nomRubro: "Deudas",
          tipoRol: "PASIVO",
          unidadNegocioId: 2,
        }),
        plan({
          cuenta: "VENTAS FREDY",
          rubroId: null,
          nomRubro: null,
          tipoRol: null,
          subrubroId: 1,
          unidadNegocioId: 2,
        }),
      ],
      compartida
    );
  }

  it("las cuentas de la otra Unidad se suman en una línea con el nombre de esa Unidad", () => {
    const report = buildInformeReport(PERIODO, [empresaCompartida(60)]);

    // Saldo final de las cuentas de la otra Unidad: 0 - 40 - 60 = -100 (acreedor).
    const todas = [...report.balance.activo, ...report.balance.pasivo, ...report.balance.patrimonioNeto];
    const lineas = todas.filter((l) => l.nombre === "Fredy Publicidad");
    expect(lineas).toHaveLength(1);
    expect(lineas[0].codRubro).toBeLessThanOrEqual(-1000);
    // Exposición cambiante: saldo acreedor → Pasivo, expuesto en positivo.
    expect(report.balance.pasivo.map((l) => l.nombre)).toContain("Fredy Publicidad");
    expect(lineas[0].saldoFinal).toBe(100);
    // El rubro "Deudas" de esa cuenta no aparece: se ignora.
    expect(todas.map((l) => l.nombre)).not.toContain("Deudas");
    // Cierra la ecuación contable.
    expect(report.balance.control).toBe(0);
  });

  it("según el signo del saldo agregado de la otra Unidad, la línea va a Pasivo o a Activo", () => {
    const conSaldoOtraUnidad = (debe: number, haber: number) =>
      buildInformeReport(PERIODO, [
        empresa(
          [saldo("CUENTA FREDY", 0, 0, debe, haber)],
          [plan({ cuenta: "CUENTA FREDY", rubroId: 2, nomRubro: "X", tipoRol: "ACTIVO", unidadNegocioId: 2 })],
          compartida
        ),
      ]);

    expect(conSaldoOtraUnidad(0, 100).balance.pasivo.map((l) => l.nombre)).toContain("Fredy Publicidad");
    expect(conSaldoOtraUnidad(100, 0).balance.activo.map((l) => l.nombre)).toContain("Fredy Publicidad");
  });

  it("las cuentas de la otra Unidad no aportan al Resultado del período", () => {
    const report = buildInformeReport(PERIODO, [empresaCompartida(60)]);
    expect(Math.abs(report.resultadoDelPeriodo)).toBe(0);
  });

  it("entran a la hoja NOF como No Operativas", () => {
    const report = buildInformeReport(PERIODO, [empresaCompartida(60)]);
    expect(report.nof.noOperativo.map((l) => l.nombre)).toEqual(["Fredy Publicidad"]);
  });

  it("una Empresa que no comparte BSyS no cambia: no hay líneas de Intercompany", () => {
    const report = buildInformeReport(PERIODO, [
      empresa(
        [saldo("CAJA", 0, 0, 100, 0)],
        [plan({ cuenta: "CAJA", rubroId: 1, nomRubro: "Disponibilidades", tipoRol: "ACTIVO", unidadNegocioId: 2 })]
      ),
    ]);
    expect(report.balance.activo.map((l) => l.nombre)).toEqual(["Disponibilidades"]);
  });
});

describe("buildInformeReport — Resultado del período", () => {
  it("coincide con la suma de las cuentas con Subrubro (una cuenta de Resultado no lleva Rubro)", () => {
    const empresas = [
      empresa(
        [
          saldo("VENTAS", 0, 0, 0, 1000),
          saldo("COSTOS", 0, 0, 400, 0),
        ],
        [
          plan({ cuenta: "VENTAS", rubroId: null, nomRubro: null, tipoRol: null, subrubroId: 1 }),
          plan({ cuenta: "COSTOS", rubroId: null, nomRubro: null, tipoRol: null, subrubroId: 2 }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    // Crudo: Ventas final=-1000, Costos final=+400 → suma=-600.
    // Expuesto (positivo=ganancia) = -(-600) = 600.
    expect(report.resultadoDelPeriodo).toBe(600);
  });
});

describe("buildInformeReport — cuentas sin Rubro", () => {
  it("Cuenta sin Rubro ni Subrubro: no entra al balance y queda en cuentasSinRubro", () => {
    const empresas = [
      empresa(
        [saldo("SIN CLASIFICAR", 0, 0, 100, 0)],
        [plan({ cuenta: "SIN CLASIFICAR", rubroId: null, nomRubro: null, tipoRol: null })]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.balance.activo).toHaveLength(0);
    expect(report.cuentasSinRubro).toHaveLength(1);
    expect(report.cuentasSinRubro[0].cuenta).toBe("SIN CLASIFICAR");
  });

  it("Cuenta sin Rubro pero CON Subrubro: no genera aviso (es de Resultado a propósito)", () => {
    const empresas = [
      empresa(
        [saldo("VENTAS", 0, 0, 0, 1000)],
        [plan({ cuenta: "VENTAS", rubroId: null, nomRubro: null, tipoRol: null, subrubroId: 1 })]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.cuentasSinRubro).toHaveLength(0);
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

describe("buildInformeReport — exposición cambiante", () => {
  it("Tipo sin rol con exposición cambiante y saldo deudor: el Rubro cae en Activo", () => {
    const empresas = [
      empresa(
        [saldo("SALDO A FAVOR", 0, 0, 100, 0)],
        [
          plan({
            cuenta: "SALDO A FAVOR",
            rubroId: 10,
            nomRubro: "IVA Neto",
            tipoRol: null,
            exposicionCambiante: true,
          }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.balance.activo).toHaveLength(1);
    expect(report.balance.activo[0].nombre).toBe("IVA Neto");
    expect(report.balance.activo[0].saldoFinal).toBe(100);
    expect(report.balance.pasivo).toHaveLength(0);
  });

  it("Tipo sin rol con exposición cambiante y saldo acreedor: el Rubro cae en Pasivo", () => {
    const empresas = [
      empresa(
        [saldo("SALDO A FAVOR", 0, 0, 0, 100)],
        [
          plan({
            cuenta: "SALDO A FAVOR",
            rubroId: 10,
            nomRubro: "IVA Neto",
            tipoRol: null,
            exposicionCambiante: true,
          }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.balance.pasivo).toHaveLength(1);
    expect(report.balance.pasivo[0].nombre).toBe("IVA Neto");
    expect(report.balance.pasivo[0].saldoFinal).toBe(100);
    expect(report.balance.activo).toHaveLength(0);
  });

  it("exposición cambiante ignora cualquier Rol fijo configurado (ej. Intercompanies con Rol=ACTIVO)", () => {
    const empresas = [
      empresa(
        [saldo("INTERCOMPANIES", 0, 0, 0, 5869)],
        [
          plan({
            cuenta: "INTERCOMPANIES",
            rubroId: 11,
            nomRubro: "Intercompanies",
            tipoRol: "ACTIVO",
            exposicionCambiante: true,
          }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.balance.activo).toHaveLength(0);
    expect(report.balance.pasivo).toHaveLength(1);
    expect(report.balance.pasivo[0].nombre).toBe("Intercompanies");
    expect(report.balance.pasivo[0].saldoFinal).toBe(5869);
  });

  it("Rubro de exposición cambiante: queda al final del bucket aunque su Orden sea menor", () => {
    const empresas = [
      empresa(
        [
          saldo("CAJA", 100, 0, 150, 0),
          saldo("SALDO A FAVOR", 0, 0, 50, 0),
        ],
        [
          plan({
            cuenta: "CAJA",
            rubroId: 1,
            nomRubro: "Disponibilidades",
            tipoRol: "ACTIVO",
            rubroOrden: 5,
          }),
          plan({
            cuenta: "SALDO A FAVOR",
            rubroId: 10,
            nomRubro: "IVA Neto",
            tipoRol: null,
            exposicionCambiante: true,
            rubroOrden: 1,
          }),
        ]
      ),
    ];

    const report = buildInformeReport(PERIODO, empresas);

    expect(report.balance.activo.map((l) => l.nombre)).toEqual(["Disponibilidades", "IVA Neto"]);
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

describe("bucketNOFDeUnidad — CTO/ONP/ARS por unidad", () => {
  it("sin elección de la unidad, usa el default del Rubro", () => {
    expect(bucketNOFDeUnidad("OPERATIVO", new Map(), 1)).toBe("OPERATIVO");
  });

  it("la elección de la unidad gana sobre el default del Rubro", () => {
    expect(bucketNOFDeUnidad("OPERATIVO", new Map([[1, "NO_OPERATIVO"]]), 1)).toBe("NO_OPERATIVO");
  });

  it("elegir 'sin clasificar' en la unidad también gana (null a propósito)", () => {
    expect(bucketNOFDeUnidad("OPERATIVO", new Map([[1, null]]), 1)).toBeNull();
  });

  it("la elección de otro Rubro no afecta a éste", () => {
    expect(bucketNOFDeUnidad("FINANCIAMIENTO", new Map([[2, "OPERATIVO"]]), 1)).toBe("FINANCIAMIENTO");
  });
});
