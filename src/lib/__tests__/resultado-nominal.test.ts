import { describe, expect, it } from "vitest";
import { computeResultadoNominalDeEmpresaPure } from "@/lib/resultado-nominal";

describe("computeResultadoNominalDeEmpresaPure", () => {
  it("Resultado nominal del mes: es la diferencia entre saldo de cierre y saldo de inicio", () => {
    const { valores, advertencias } = computeResultadoNominalDeEmpresaPure(
      "Empresa Test",
      [
        // Crudo (crédito-normal): inicio=-1000, cierre=-1500 → movimiento
        // crudo -500 → "favorable" (positivo=ganancia) = 500.
        { cuenta: "VENTAS", saldoIniDebe: 0, saldoIniHaber: 1000, saldoCierreDebe: 0, saldoCierreHaber: 1500 },
      ],
      [{ cuenta: "VENTAS", rubroId: null, subrubroId: 1, nomSubrubro: "Ventas", campoResultado: "VENTAS" }]
    );

    expect(advertencias).toHaveLength(0);
    expect(valores.ventas).toBe(500);
  });

  it("Cuenta sin Rubro ni Subrubro: no aporta al resultado y queda en cuentasSinSubrubro", () => {
    const { valores, cuentasSinSubrubro } = computeResultadoNominalDeEmpresaPure(
      "Empresa Test",
      [{ cuenta: "SIN CLASIFICAR", saldoIniDebe: 0, saldoIniHaber: 0, saldoCierreDebe: 100, saldoCierreHaber: 0 }],
      [{ cuenta: "SIN CLASIFICAR", rubroId: null, subrubroId: null, nomSubrubro: null, campoResultado: null }]
    );

    expect(valores.ventas).toBe(0);
    expect(cuentasSinSubrubro).toHaveLength(1);
  });

  it("Cuenta con Rubro (Balance) pero sin Subrubro: no aporta al resultado y NO genera aviso", () => {
    const { cuentasSinSubrubro } = computeResultadoNominalDeEmpresaPure(
      "Empresa Test",
      [{ cuenta: "CAJA", saldoIniDebe: 0, saldoIniHaber: 0, saldoCierreDebe: 100, saldoCierreHaber: 0 }],
      [{ cuenta: "CAJA", rubroId: 1, subrubroId: null, nomSubrubro: null, campoResultado: null }]
    );

    expect(cuentasSinSubrubro).toHaveLength(0);
  });
});
