"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

type Adjunto = { id: string; nombreArchivo: string; mimeType: string };

type Diapositiva =
  | { tipo: "pagina"; doc: PDFDocumentProxy; num: number; etiqueta: string }
  | { tipo: "imagen"; url: string; etiqueta: string }
  | { tipo: "noVisible"; nombre: string; url: string };

const URL_ADJUNTO = (id: string) => `/api/adjuntos/informe/${id}`;

// pdf.js se carga recién al presentar (usa APIs del navegador, no se puede
// importar en el servidor) y con su worker como archivo aparte.
async function cargarPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

async function abrirPdf(url: string): Promise<PDFDocumentProxy> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo descargar el archivo (${respuesta.status}).`);
  const pdfjs = await cargarPdfJs();
  return pdfjs.getDocument({ data: await respuesta.arrayBuffer() }).promise;
}

function paginasDe(doc: PDFDocumentProxy, nombre: string): Diapositiva[] {
  return Array.from({ length: doc.numPages }, (_, i) => ({
    tipo: "pagina" as const,
    doc,
    num: i + 1,
    etiqueta: `${nombre} (${i + 1}/${doc.numPages})`,
  }));
}

// Una página de un PDF dibujada para ocupar toda la pantalla, sin deformarse.
function PaginaPdf({ doc, num }: { doc: PDFDocumentProxy; num: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tamano, setTamano] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    const alCambiar = () => setTamano({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);

  useEffect(() => {
    let cancelado = false;
    let tarea: RenderTask | null = null;
    (async () => {
      const pagina = await doc.getPage(num);
      const canvas = canvasRef.current;
      if (cancelado || !canvas) return;
      const base = pagina.getViewport({ scale: 1 });
      const escala = Math.min(tamano.w / base.width, tamano.h / base.height);
      const viewport = pagina.getViewport({ scale: escala * (window.devicePixelRatio || 1) });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(base.width * escala)}px`;
      canvas.style.height = `${Math.floor(base.height * escala)}px`;
      tarea = pagina.render({ canvas, viewport });
      await tarea.promise.catch(() => undefined);
    })();
    return () => {
      cancelado = true;
      tarea?.cancel();
    };
  }, [doc, num, tamano]);

  return <canvas ref={canvasRef} className="bg-white shadow-2xl" />;
}

function Presentacion({
  informeId,
  titulo,
  adjuntos,
  onCerrar,
}: {
  informeId: string;
  titulo: string;
  adjuntos: Adjunto[];
  onCerrar: () => void;
}) {
  const [diapositivas, setDiapositivas] = useState<Diapositiva[]>([]);
  const [indice, setIndice] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // La lista de adjuntos llega como un array nuevo en cada render del servidor:
  // se toma una copia estable (por los ids) para no reiniciar la presentación.
  const adjuntosRef = useRef(adjuntos);
  const claveAdjuntos = adjuntos.map((a) => a.id).join(",");

  // Primero las hojas del informe (el mismo PDF que se descarga) y después los
  // adjuntos, uno detrás del otro, como una sola presentación. Los adjuntos se
  // van sumando a medida que se cargan, sin hacer esperar al informe.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const informe = await abrirPdf(`/api/informes/${informeId}/pdf`);
        if (cancelado) return;
        setDiapositivas(paginasDe(informe, "Informe"));

        for (const adjunto of adjuntosRef.current) {
          const url = URL_ADJUNTO(adjunto.id);
          let nuevas: Diapositiva[];
          if (adjunto.mimeType.startsWith("image/")) {
            nuevas = [{ tipo: "imagen", url, etiqueta: adjunto.nombreArchivo }];
          } else if (adjunto.mimeType === "application/pdf") {
            try {
              nuevas = paginasDe(await abrirPdf(url), adjunto.nombreArchivo);
            } catch {
              nuevas = [{ tipo: "noVisible", nombre: adjunto.nombreArchivo, url }];
            }
          } else {
            // Word y Excel no se pueden dibujar en el navegador.
            nuevas = [{ tipo: "noVisible", nombre: adjunto.nombreArchivo, url }];
          }
          if (cancelado) return;
          setDiapositivas((prev) => [...prev, ...nuevas]);
        }
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo preparar la presentación.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [informeId, claveAdjuntos]);

  const total = diapositivas.length;
  const ir = useCallback(
    (delta: number) => setIndice((i) => Math.max(0, Math.min(Math.max(total - 1, 0), i + delta))),
    [total]
  );

  // Flecha abajo avanza una hoja y flecha arriba retrocede una; también
  // derecha/izquierda y RePág/AvPág. Esc sale.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        ir(1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        ir(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndice(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIndice(Math.max(total - 1, 0));
      } else if (e.key === "Escape") {
        onCerrar();
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ir, onCerrar, total]);

  const actual = diapositivas[indice];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Presentación: ${titulo}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      {actual?.tipo === "pagina" && <PaginaPdf key={`${indice}`} doc={actual.doc} num={actual.num} />}
      {actual?.tipo === "imagen" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={actual.url} alt={actual.etiqueta} className="max-h-full max-w-full object-contain" />
      )}
      {actual?.tipo === "noVisible" && (
        <div className="max-w-xl rounded bg-white p-8 text-center text-zinc-800">
          <p className="text-lg font-medium">{actual.nombre}</p>
          <p className="mt-2 text-sm text-zinc-600">
            Este tipo de archivo (Word o Excel) no se puede mostrar en la presentación. Abrilo aparte:
          </p>
          <a
            href={actual.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover"
          >
            Abrir archivo
          </a>
        </div>
      )}

      {!actual && !error && <p className="text-white">Preparando la presentación…</p>}
      {error && <p className="max-w-lg rounded bg-red-900 p-4 text-white">{error}</p>}

      <div className="pointer-events-none absolute bottom-3 right-4 rounded bg-black/60 px-3 py-1 text-xs text-white">
        {total > 0 ? `${indice + 1} / ${total}${cargando ? " …" : ""}` : ""}
        {" · "}
        {actual && "etiqueta" in actual ? actual.etiqueta : actual ? actual.nombre : titulo}
        {" · ↑ ↓ para navegar · Esc para salir"}
      </div>

      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar la presentación"
        className="absolute right-4 top-3 rounded bg-black/60 px-3 py-1 text-sm text-white opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

// Botón PRESENTACION de la ventana Consulta: muestra a pantalla completa las
// hojas del informe y a continuación todos sus adjuntos, como una sola
// presentación. Solo para informes aprobados (es el mismo PDF que se descarga).
export function PresentacionButton({
  informeId,
  titulo,
  estado,
  adjuntos,
}: {
  informeId: string;
  titulo: string;
  estado: string;
  adjuntos: Adjunto[];
}) {
  const [abierta, setAbierta] = useState(false);
  const aprobado = estado === "APROBADO";

  function abrir() {
    setAbierta(true);
    // Debe pedirse dentro del clic (gesto del usuario). Si el navegador no lo
    // permite, la presentación igual tapa toda la ventana.
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  const cerrar = useCallback(() => {
    setAbierta(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }, []);

  // Salir de la pantalla completa con Esc también cierra la presentación.
  useEffect(() => {
    if (!abierta) return;
    function alCambiar() {
      if (!document.fullscreenElement) setAbierta(false);
    }
    // Se espera a que haya entrado en pantalla completa antes de escuchar la salida.
    let escuchando = false;
    const activar = window.setTimeout(() => {
      escuchando = true;
    }, 800);
    const handler = () => {
      if (escuchando) alCambiar();
    };
    document.addEventListener("fullscreenchange", handler);
    return () => {
      window.clearTimeout(activar);
      document.removeEventListener("fullscreenchange", handler);
    };
  }, [abierta]);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={!aprobado}
        title={
          aprobado
            ? "Presentar el informe y sus adjuntos a pantalla completa"
            : "Solo se puede presentar un informe aprobado"
        }
        className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ▶ Presentación
      </button>
      {abierta && <Presentacion informeId={informeId} titulo={titulo} adjuntos={adjuntos} onCerrar={cerrar} />}
    </>
  );
}
