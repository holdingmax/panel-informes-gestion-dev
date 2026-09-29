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
      [{ cuenta: "VENTAS", nomRubro: "VENTAS", tipoRol: "RESULTADO" }]
    );

    expect(advertencias).toHaveLength(0);
    expect(valores.ventas).toBe(500);
  });
});
