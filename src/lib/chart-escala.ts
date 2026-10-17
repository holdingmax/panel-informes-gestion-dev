// Escala "linda" (límites y paso redondos) para el eje de valores del gráfico
// de Ventas y Rentabilidad Neta. La usan la pantalla (VentasRentabilidadChart)
// y el PDF (informe-pdf.tsx) para que ambos dibujen exactamente lo mismo.
export function calcularEscala(min: number, max: number) {
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
