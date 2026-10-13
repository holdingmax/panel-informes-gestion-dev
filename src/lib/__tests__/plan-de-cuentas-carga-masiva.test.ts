import { describe, expect, it } from "vitest";
import {
  analizarFilas,
  codigoNumerico,
  normalizarTexto,
  type CatalogosCarga,
  type FilaCarga,
} from "@/lib/plan-de-cuentas-carga-masiva-core";

const CATALOGOS: CatalogosCarga = {
  empresas: [{ id: 1, nombre: "Handyway Cargo", comparteBsys: false, unidades: [] }],
  partidas: [
    { id: 10, nombre: "Activo Corriente" },
    { id: 11, nombre: "Pasivo Corriente" },
  ],
  rubros: [
    { id: 100, nombre: "Caja y bancos", partidaId: 10 },
    { id: 101, nombre: "Deudas comerciales", partidaId: 11 },
  ],
  subrubros: [{ id: 200, nombre: "Ventas" }],
  subrubros2: [],
  subrubros3: [],
};

let n = 1;
function fila(parcial: Partial<FilaCarga>): FilaCarga {
  return {
    fila: ++n,
    empresa: "",
    cuenta: "",
    partida: "",
    rubro: "",
    subrubro: "",
    subrubro2: "",
    subrubro3: "",
    cuitCompartido: "",
    ...parcial,
  };
}

const INICIAL = { empresasIniciales: new Set([1]), codigosExistentes: new Map(), resoluciones: {} };
const CON_CUENTAS = {
  empresasIniciales: new Set<number>(),
  codigosExistentes: new Map([[1, new Set(["1.01.01"])]]),
  resoluciones: {},
};

describe("codigoNumerico", () => {
  it("toma los primeros caracteres numéricos del nombre", () => {
    expect(codigoNumerico("5.00.29.06 - MOVILIDAD Y VIATICO")).toBe("5.00.29.06");
    expect(codigoNumerico("  1.02.02.01.00 - Titulos")).toBe("1.02.02.01.00");
    expect(codigoNumerico("100 CAJA")).toBe("100");
  });

  it("devuelve null si el nombre no empieza con números", () => {
    expect(codigoNumerico("CAJA 1.01")).toBeNull();
    expect(codigoNumerico("")).toBeNull();
  });
});

describe("normalizarTexto", () => {
  it("ignora mayúsculas, acentos y espacios repetidos", () => {
    expect(normalizarTexto("  Cajas  y BANCOS ")).toBe("cajas y bancos");
    expect(normalizarTexto("Pérdidas")).toBe("perdidas");
  });
});

describe("analizarFilas — carga sobre un plan que ya tiene cuentas", () => {
  it("descarta la cuenta cuyo comienzo numérico ya existe, aunque el resto del texto sea distinto", () => {
    const r = analizarFilas(
      [fila({ cuenta: "1.01.01 - CAJA CHICA" }), fila({ cuenta: "1.01.02 - BANCO" })],
      CATALOGOS,
      CON_CUENTAS
    );
    expect(r.descartadasExistentes).toHaveLength(1);
    expect(r.aCargar.map((c) => c.cuenta)).toEqual(["1.01.02 - BANCO"]);
  });

  it("descarta como error la cuenta que no empieza con números", () => {
    const r = analizarFilas([fila({ cuenta: "CAJA SIN CODIGO" })], CATALOGOS, CON_CUENTAS);
    expect(r.aCargar).toHaveLength(0);
    expect(r.descartadasError[0].motivo).toMatch(/números/);
  });

  it("descarta la cuenta repetida dentro del archivo y se queda con la primera", () => {
    const r = analizarFilas(
      [fila({ cuenta: "2.01 - A" }), fila({ cuenta: "2.01 - B" })],
      CATALOGOS,
      CON_CUENTAS
    );
    expect(r.aCargar.map((c) => c.cuenta)).toEqual(["2.01 - A"]);
    expect(r.descartadasError).toHaveLength(1);
  });

  it("un valor que no está en la tabla de referencia descarta la fila (no hay ventana de conflictos)", () => {
    const r = analizarFilas([fila({ cuenta: "3.01 - X", rubro: "Cajas y Bancos" })], CATALOGOS, CON_CUENTAS);
    expect(r.aCargar).toHaveLength(0);
    expect(r.conflictos).toHaveLength(0);
    expect(r.descartadasError[0].motivo).toMatch(/Rubro "Cajas y Bancos" no existe/);
  });

  it("con valores válidos (sin importar mayúsculas) carga la cuenta con sus ids", () => {
    const r = analizarFilas(
      [fila({ cuenta: "3.01 - VENTAS", rubro: "CAJA Y BANCOS", subrubro: "ventas", partida: "activo corriente" })],
      CATALOGOS,
      CON_CUENTAS
    );
    expect(r.aCargar[0]).toMatchObject({ empresaId: 1, rubroId: 100, subrubroId: 200 });
  });

  it("los campos de referencia pueden estar vacíos", () => {
    const r = analizarFilas([fila({ cuenta: "4.01 - SIN CLASIFICAR" })], CATALOGOS, CON_CUENTAS);
    expect(r.aCargar[0]).toMatchObject({ rubroId: null, subrubroId: null });
  });

  it("rechaza la fila si el rubro no pertenece a la partida indicada", () => {
    const r = analizarFilas(
      [fila({ cuenta: "5.01 - X", rubro: "Caja y bancos", partida: "Pasivo Corriente" })],
      CATALOGOS,
      CON_CUENTAS
    );
    expect(r.aCargar).toHaveLength(0);
    expect(r.descartadasError[0].motivo).toMatch(/pertenece a la partida "Activo Corriente"/);
  });

  it("empresa vacía con una sola empresa en la unidad: usa esa", () => {
    const r = analizarFilas([fila({ cuenta: "6.01 - X", empresa: "" })], CATALOGOS, CON_CUENTAS);
    expect(r.aCargar[0].empresaId).toBe(1);
  });

  it("empresa vacía con varias empresas: descarta la fila", () => {
    const r = analizarFilas([fila({ cuenta: "6.01 - X" })], {
      ...CATALOGOS,
      empresas: [...CATALOGOS.empresas, { id: 2, nombre: "Otra", comparteBsys: false, unidades: [] }],
    }, CON_CUENTAS);
    expect(r.aCargar).toHaveLength(0);
    expect(r.descartadasError[0].motivo).toMatch(/empresa está vacía/);
  });
});

describe("analizarFilas — carga inicial (empresa sin cuentas)", () => {
  it("un valor inválido genera un conflicto agrupado, con las opciones vigentes", () => {
    const r = analizarFilas(
      [
        fila({ cuenta: "1.01 - A", rubro: "Cajas y Bancos" }),
        fila({ cuenta: "1.02 - B", rubro: "cajas y bancos" }),
      ],
      CATALOGOS,
      INICIAL
    );
    expect(r.aCargar).toHaveLength(0);
    expect(r.conflictos).toHaveLength(1);
    expect(r.conflictos[0].filas).toHaveLength(2);
    expect(r.conflictos[0].opciones.map((o) => o.valor)).toEqual(["Caja y bancos", "Deudas comerciales"]);
    expect(r.conflictos[0].etiquetaVaciar).not.toBeNull();
  });

  it("al elegir un valor vigente, carga las cuentas con ese valor", () => {
    const r = analizarFilas(
      [fila({ cuenta: "1.01 - A", rubro: "Cajas y Bancos" })],
      CATALOGOS,
      { ...INICIAL, resoluciones: { "Rubro|cajas y bancos": { accion: "usar", valor: "Caja y bancos" } } }
    );
    expect(r.conflictos).toHaveLength(0);
    expect(r.aCargar[0].rubroId).toBe(100);
  });

  it("al elegir dejar vacío, carga la cuenta sin ese valor", () => {
    const r = analizarFilas(
      [fila({ cuenta: "1.01 - A", rubro: "Cajas y Bancos" })],
      CATALOGOS,
      { ...INICIAL, resoluciones: { "Rubro|cajas y bancos": { accion: "vaciar" } } }
    );
    expect(r.aCargar[0].rubroId).toBeNull();
  });

  it("una empresa que no es de la unidad es un conflicto sin opción de dejar vacío", () => {
    const r = analizarFilas([fila({ cuenta: "1.01 - A", empresa: "Panini" })], CATALOGOS, INICIAL);
    expect(r.conflictos[0].campo).toBe("Empresa");
    expect(r.conflictos[0].etiquetaVaciar).toBeNull();
  });

  it("partida y rubro incoherentes: conflicto con opción de mantener el rubro o dejarlo vacío", () => {
    const r = analizarFilas(
      [fila({ cuenta: "1.01 - A", rubro: "Caja y bancos", partida: "Pasivo Corriente" })],
      CATALOGOS,
      INICIAL
    );
    expect(r.conflictos[0].campo).toBe("Partida y Rubro");
    expect(r.conflictos[0].opciones).toHaveLength(1);
  });

  it("las cuentas que ya existen o no tienen número se descartan sin generar conflictos", () => {
    const r = analizarFilas([fila({ cuenta: "SIN NUMERO", rubro: "inexistente" })], CATALOGOS, INICIAL);
    expect(r.conflictos).toHaveLength(0);
    expect(r.descartadasError).toHaveLength(1);
  });
});

describe("analizarFilas — empresa que comparte BSyS (Cuit compartido)", () => {
  const UNIDADES = [
    { id: 20, nombre: "Fredy Publicidad" },
    { id: 21, nombre: "Crear Construcciones y Mantenimiento" },
  ];
  const COMPARTIDA: CatalogosCarga = {
    ...CATALOGOS,
    empresas: [{ id: 1, nombre: "Crear", comparteBsys: true, unidades: UNIDADES }],
  };

  it("toma la unidad de la columna Cuit compartido (sin importar mayúsculas)", () => {
    const r = analizarFilas(
      [
        fila({ cuenta: "1.01 - A", cuitCompartido: "fredy publicidad" }),
        fila({ cuenta: "1.02 - B", cuitCompartido: "Crear Construcciones y Mantenimiento" }),
      ],
      COMPARTIDA,
      INICIAL
    );
    expect(r.conflictos).toHaveLength(0);
    expect(r.aCargar.map((c) => c.unidadNegocioId)).toEqual([20, 21]);
  });

  it("carga inicial: un cuit compartido inválido es un conflicto con las unidades como opciones, sin dejar vacío", () => {
    const r = analizarFilas([fila({ cuenta: "1.01 - A", cuitCompartido: "Otra unidad" })], COMPARTIDA, INICIAL);
    expect(r.aCargar).toHaveLength(0);
    expect(r.conflictos[0].campo).toBe("Cuit compartido");
    expect(r.conflictos[0].opciones.map((o) => o.valor)).toEqual(UNIDADES.map((u) => u.nombre));
    expect(r.conflictos[0].etiquetaVaciar).toBeNull();
  });

  it("carga inicial: el cuit compartido vacío también es un conflicto (no se asigna ninguna unidad por defecto)", () => {
    const r = analizarFilas(
      [fila({ cuenta: "1.01 - A" }), fila({ cuenta: "1.02 - B" })],
      COMPARTIDA,
      INICIAL
    );
    expect(r.aCargar).toHaveLength(0);
    expect(r.conflictos).toHaveLength(1);
    expect(r.conflictos[0].filas).toHaveLength(2);
    expect(r.conflictos[0].mensaje).toMatch(/Falta el cuit compartido/);
  });

  it("al elegir una unidad para el conflicto, las cuentas se cargan con esa unidad", () => {
    const r = analizarFilas([fila({ cuenta: "1.01 - A", cuitCompartido: "Fredi" })], COMPARTIDA, {
      ...INICIAL,
      resoluciones: { "Cuit compartido|1|fredi": { accion: "usar", valor: "Fredy Publicidad" } },
    });
    expect(r.conflictos).toHaveLength(0);
    expect(r.aCargar[0].unidadNegocioId).toBe(20);
  });

  it("con cuentas ya cargadas (sin ventana) una fila sin cuit compartido válido se descarta con su motivo", () => {
    const r = analizarFilas([fila({ cuenta: "2.01 - A", cuitCompartido: "Inexistente" })], COMPARTIDA, CON_CUENTAS);
    expect(r.aCargar).toHaveLength(0);
    expect(r.conflictos).toHaveLength(0);
    expect(r.descartadasError[0].motivo).toMatch(/no es una de las unidades que comparten/);
  });

  it("en una empresa que no comparte BSyS el cuit compartido se ignora y la unidad queda en null", () => {
    const r = analizarFilas([fila({ cuenta: "1.01 - A", cuitCompartido: "Lo que sea" })], CATALOGOS, CON_CUENTAS);
    expect(r.aCargar[0].unidadNegocioId).toBeNull();
  });
});
