import { describe, expect, it } from "vitest";
import { inicioEjercicio } from "@/lib/resultado-cuadro";

describe("inicioEjercicio", () => {
  it("Ejercicio julio–junio: el período 06/2026 pertenece al ejercicio iniciado en 07/2025", () => {
    expect(inicioEjercicio(6, 2026)).toEqual({ mes: 7, anio: 2025 });
  });

  it("el período 07/2026 (primer mes del ejercicio) pertenece a su propio ejercicio", () => {
    expect(inicioEjercicio(7, 2026)).toEqual({ mes: 7, anio: 2026 });
  });
});
