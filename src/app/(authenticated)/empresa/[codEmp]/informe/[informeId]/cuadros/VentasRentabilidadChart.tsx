import type { MesEvolucion } from "@/lib/resultado-cuadro";

const WIDTH = 900;
const HEIGHT = 420;
const MARGIN = { top: 30, right: 20, bottom: 50, left: 80 };
const COLOR_VENTAS = "#4472C4";
const COLOR_RENTABILIDAD = "#ED7D31";

function calcularEscala(min: number, max: number) {
  const span = max - min || 1;
  const rawStep = span / 5;
  const magnitud = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residuo = rawStep / magnitud;
  const step = residuo > 5 ? 10 * magnitud : residuo > 2 ? 5 * magnitud : residuo > 1 ? 2 * magnitud : magnitud;
  const niceMin = Math.floor(min / step) * step;
  let niceMax = Math.ceil(max / step) * step;
  // Datos todos en cero (unidad sin historial todavía): evita 0/0 al escalar.
  if (niceMax === niceMin) niceMax = niceMin + step;
  return { niceMin, niceMax, step };
}

// Gráfico de barras (Ventas) + línea (Rentabilidad Neta) de los últimos 12
// meses — SVG estático a mano (sin librería de gráficos) para mantener los
// colores y la forma del modelo de referencia sin agregar una dependencia
// nueva solo para un combo-chart.
export function VentasRentabilidadChart({ meses }: { meses: MesEvolucion[] }) {
  const datos = meses.map((m) => ({
    label: m.label,
    ventas: m.valores?.ventas ?? 0,
    rentabilidadNeta: m.valores?.rentabilidadNeta ?? 0,
  }));

  const todosLosValores = datos.flatMap((d) => [d.ventas, d.rentabilidadNeta, 0]);
  const { niceMin, niceMax, step } = calcularEscala(Math.min(...todosLosValores), Math.max(...todosLosValores));

  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const y = (v: number) => MARGIN.top + plotH - ((v - niceMin) / (niceMax - niceMin)) * plotH;
  const slotW = plotW / datos.length;
  const xCentro = (i: number) => MARGIN.left + (i + 0.5) * slotW;
  const barW = slotW * 0.5;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v));

  const puntosLinea = datos.map((d, i) => `${xCentro(i)},${y(d.rentabilidadNeta)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Evolución de Ventas y Rentabilidad Neta de los últimos 12 meses"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={MARGIN.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#666">
            {t.toLocaleString("es-AR")}
          </text>
        </g>
      ))}

      {datos.map((d, i) => {
        const top = Math.min(y(0), y(d.ventas));
        const height = Math.abs(y(0) - y(d.ventas));
        return (
          <rect
            key={d.label}
            x={xCentro(i) - barW / 2}
            y={top}
            width={barW}
            height={height}
            fill={COLOR_VENTAS}
          />
        );
      })}

      <polyline points={puntosLinea} fill="none" stroke={COLOR_RENTABILIDAD} strokeWidth={2.5} />
      {datos.map((d, i) => (
        <circle key={d.label} cx={xCentro(i)} cy={y(d.rentabilidadNeta)} r={3} fill={COLOR_RENTABILIDAD} />
      ))}

      {datos.map((d, i) => (
        <text
          key={d.label}
          x={xCentro(i)}
          y={HEIGHT - MARGIN.bottom + 20}
          textAnchor="middle"
          fontSize={11}
          fill="#444"
        >
          {d.label}
        </text>
      ))}

      <g transform={`translate(${MARGIN.left}, 10)`}>
        <rect x={0} y={-8} width={12} height={12} fill={COLOR_VENTAS} />
        <text x={18} y={2} fontSize={11} fill="#444">
          Ventas
        </text>
        <line x1={90} y1={-2} x2={110} y2={-2} stroke={COLOR_RENTABILIDAD} strokeWidth={2.5} />
        <text x={116} y={2} fontSize={11} fill="#444">
          Rentabilidad Neta
        </text>
      </g>
    </svg>
  );
}
