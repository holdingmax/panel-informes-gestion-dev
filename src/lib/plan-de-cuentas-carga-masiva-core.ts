// Núcleo puro (sin Prisma ni Excel) de la carga masiva del Plan de Cuentas: se
// puede testear con datos armados a mano. La acción que lee el archivo y
// escribe en la base está en plan-de-cuentas-carga-masiva.ts.

export type CampoCarga =
  | "Empresa"
  | "Partida"
  | "Rubro"
  | "Subrubro"
  | "Subrubro 2"
  | "Subrubro 3"
  | "Partida y Rubro";

export type FilaCarga = {
  // Número de fila en la hoja de Excel, para poder avisar dónde está cada problema.
  fila: number;
  empresa: string;
  cuenta: string;
  partida: string;
  rubro: string;
  subrubro: string;
  subrubro2: string;
  subrubro3: string;
};

type Ref = { id: number; nombre: string };

export type CatalogosCarga = {
  // Solo las Empresas de la Unidad cuyo Plan de Cuentas se está cargando.
  empresas: Ref[];
  partidas: Ref[];
  rubros: (Ref & { partidaId: number | null })[];
  subrubros: Ref[];
  subrubros2: Ref[];
  subrubros3: Ref[];
};

export type Resolucion = { accion: "usar"; valor: string } | { accion: "vaciar" };

export type Conflicto = {
  // Clave estable para guardar la elección del operador (campo + valor).
  clave: string;
  campo: CampoCarga;
  valor: string;
  mensaje: string;
  filas: number[];
  // Valores vigentes entre los que puede elegir.
  opciones: { valor: string; etiqueta: string }[];
  // Si puede dejar el campo vacío (Empresa no: es obligatoria).
  etiquetaVaciar: string | null;
};

export type FilaAceptada = {
  fila: number;
  empresaId: number;
  cuenta: string;
  rubroId: number | null;
  subrubroId: number | null;
  subrubro2Id: number | null;
  subrubro3Id: number | null;
};

export type ResultadoAnalisis = {
  aCargar: FilaAceptada[];
  // La cuenta ya está en la base (mismo comienzo numérico en la misma Empresa).
  descartadasExistentes: { fila: number; cuenta: string }[];
  descartadasError: { fila: number; cuenta: string; motivo: string }[];
  // Solo en la carga inicial de una Empresa: valores que no están en las tablas
  // de referencia y que el operador tiene que resolver.
  conflictos: Conflicto[];
};

export const LARGO_MAX_CUENTA = 90;

// Minúsculas, sin acentos y con espacios colapsados: "Cajas  y Bancos" y
// "cajas y bancos" son el mismo valor de la tabla de referencia.
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Los primeros caracteres numéricos del nombre de la cuenta ("5.00.29.06" en
// "5.00.29.06 - MOVILIDAD Y VIATICO"): es la forma en que el sistema contable
// identifica cada cuenta. Null si el nombre no empieza con un número.
export function codigoNumerico(cuenta: string): string | null {
  const m = /^\s*(\d+(?:[.\-/]\d+)*)/.exec(cuenta);
  return m ? m[1] : null;
}

function buscar<T extends Ref>(lista: T[], valor: string): T | undefined {
  const clave = normalizarTexto(valor);
  return lista.find((r) => normalizarTexto(r.nombre) === clave);
}

type AnalisisOpciones = {
  // Empresas (ids) sin ninguna cuenta cargada: ahí rige la carga inicial, con la
  // ventana de conflictos. En el resto, un valor inválido descarta la fila.
  empresasIniciales: Set<number>;
  // Códigos numéricos que ya tiene cada Empresa en la base.
  codigosExistentes: Map<number, Set<string>>;
  resoluciones: Record<string, Resolucion>;
};

export function analizarFilas(
  filas: FilaCarga[],
  catalogos: CatalogosCarga,
  opciones: AnalisisOpciones
): ResultadoAnalisis {
  const aCargar: FilaAceptada[] = [];
  const descartadasExistentes: ResultadoAnalisis["descartadasExistentes"] = [];
  const descartadasError: ResultadoAnalisis["descartadasError"] = [];
  const conflictos = new Map<string, Conflicto>();
  const vistas = new Set<string>();
  const hayEmpresaInicial = opciones.empresasIniciales.size > 0;

  function conflicto(
    clave: string,
    campo: CampoCarga,
    valor: string,
    mensaje: string,
    fila: number,
    lista: Ref[],
    etiquetaVaciar: string | null
  ) {
    const existente = conflictos.get(clave);
    if (existente) {
      existente.filas.push(fila);
      return;
    }
    conflictos.set(clave, {
      clave,
      campo,
      valor,
      mensaje,
      filas: [fila],
      opciones: lista.map((r) => ({ valor: r.nombre, etiqueta: r.nombre })),
      etiquetaVaciar,
    });
  }

  for (const f of filas) {
    const cuenta = f.cuenta.trim();
    const sinDatos = [f.empresa, f.cuenta, f.partida, f.rubro, f.subrubro, f.subrubro2, f.subrubro3].every(
      (v) => v.trim() === ""
    );
    if (sinDatos) continue;

    const rechazar = (motivo: string) => descartadasError.push({ fila: f.fila, cuenta, motivo });

    if (!cuenta) {
      rechazar("La cuenta está vacía.");
      continue;
    }
    const codigo = codigoNumerico(cuenta);
    if (!codigo) {
      rechazar("El nombre de la cuenta no empieza con una secuencia de números.");
      continue;
    }
    if (cuenta.length > LARGO_MAX_CUENTA) {
      rechazar(`El nombre supera los ${LARGO_MAX_CUENTA} caracteres.`);
      continue;
    }

    // ---- Empresa ----
    let empresa: Ref | undefined;
    if (f.empresa.trim() === "") {
      if (catalogos.empresas.length === 1) empresa = catalogos.empresas[0];
      else {
        rechazar("La empresa está vacía y la unidad tiene más de una empresa.");
        continue;
      }
    } else {
      empresa = buscar(catalogos.empresas, f.empresa);
      if (!empresa) {
        const clave = `Empresa|${normalizarTexto(f.empresa)}`;
        const res = opciones.resoluciones[clave];
        if (hayEmpresaInicial && res?.accion === "usar") {
          empresa = buscar(catalogos.empresas, res.valor);
        } else if (hayEmpresaInicial) {
          conflicto(
            clave,
            "Empresa",
            f.empresa.trim(),
            `La empresa "${f.empresa.trim()}" no es una de las empresas de esta unidad.`,
            f.fila,
            catalogos.empresas,
            null
          );
          continue;
        } else {
          rechazar(`La empresa "${f.empresa.trim()}" no es una de las empresas de esta unidad.`);
          continue;
        }
      }
    }
    if (!empresa) {
      rechazar("No se pudo determinar la empresa.");
      continue;
    }

    // ---- Ya existe / repetida en el archivo ----
    if (opciones.codigosExistentes.get(empresa.id)?.has(codigo)) {
      descartadasExistentes.push({ fila: f.fila, cuenta });
      continue;
    }
    const claveVista = `${empresa.id}|${codigo}`;
    if (vistas.has(claveVista)) {
      rechazar(`El código ${codigo} está repetido en el archivo: se toma la primera.`);
      continue;
    }
    vistas.add(claveVista);

    // ---- Tablas de referencia ----
    const inicial = opciones.empresasIniciales.has(empresa.id);
    let pendiente = false;
    let invalida = false;

    // Valor ya resuelto de un campo de referencia: undefined = quedó pendiente
    // de que el operador elija (o la fila se rechazó), null = vacío.
    function resolver<T extends Ref>(campo: CampoCarga, valor: string, lista: T[]): T | null | undefined {
      if (valor.trim() === "") return null;
      const encontrado = buscar(lista, valor);
      if (encontrado) return encontrado;

      const mensaje = `${campo} "${valor.trim()}" no existe en la tabla ${campo}.`;
      if (!inicial) {
        rechazar(mensaje);
        invalida = true;
        return undefined;
      }
      const clave = `${campo}|${normalizarTexto(valor)}`;
      const res = opciones.resoluciones[clave];
      if (res?.accion === "vaciar") return null;
      if (res?.accion === "usar") return buscar(lista, res.valor) ?? undefined;
      conflicto(clave, campo, valor.trim(), mensaje, f.fila, lista, "Dejar vacío");
      pendiente = true;
      return undefined;
    }

    const partida = resolver("Partida", f.partida, catalogos.partidas);
    let rubro = resolver("Rubro", f.rubro, catalogos.rubros);
    const subrubro = resolver("Subrubro", f.subrubro, catalogos.subrubros);
    const subrubro2 = resolver("Subrubro 2", f.subrubro2, catalogos.subrubros2);
    const subrubro3 = resolver("Subrubro 3", f.subrubro3, catalogos.subrubros3);
    if (invalida) continue;

    // Partida y Rubro a la vez: la Partida de una cuenta sale de su Rubro, así
    // que tienen que ser coherentes.
    if (partida && rubro && rubro.partidaId !== partida.id) {
      const partidaDelRubro = catalogos.partidas.find((p) => p.id === rubro!.partidaId)?.nombre;
      const mensaje = `El rubro "${rubro.nombre}" ${
        partidaDelRubro ? `pertenece a la partida "${partidaDelRubro}"` : "no tiene partida"
      }, no a "${partida.nombre}".`;
      if (!inicial) {
        rechazar(mensaje);
        continue;
      }
      const clave = `Partida y Rubro|${normalizarTexto(rubro.nombre)}|${normalizarTexto(partida.nombre)}`;
      const res = opciones.resoluciones[clave];
      if (res?.accion === "vaciar") rubro = null;
      else if (res?.accion === "usar") {
        // Mantiene el Rubro: la Partida del archivo se ignora.
      } else {
        const existente = conflictos.get(clave);
        if (existente) existente.filas.push(f.fila);
        else
          conflictos.set(clave, {
            clave,
            campo: "Partida y Rubro",
            valor: `${rubro.nombre} / ${partida.nombre}`,
            mensaje,
            filas: [f.fila],
            opciones: [
              {
                valor: "mantener-rubro",
                etiqueta: `Mantener el rubro "${rubro.nombre}" (la partida sale del rubro)`,
              },
            ],
            etiquetaVaciar: "Dejar el rubro vacío",
          });
        pendiente = true;
      }
    }

    if (pendiente) continue;
    aCargar.push({
      fila: f.fila,
      empresaId: empresa.id,
      cuenta,
      rubroId: rubro?.id ?? null,
      subrubroId: subrubro?.id ?? null,
      subrubro2Id: subrubro2?.id ?? null,
      subrubro3Id: subrubro3?.id ?? null,
    });
  }

  return { aCargar, descartadasExistentes, descartadasError, conflictos: [...conflictos.values()] };
}
