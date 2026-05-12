// D3 efficiency heatmap renderer for the EfficiencyMap component.
import { select, type Selection } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft, axisRight } from 'd3-axis'
import { interpolateRgb } from 'd3-interpolate'
import type { EfficiencyMapResult } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'

/** Colour stops for the efficiency gradient: 0 % → dark-red, 100 % → bright-green. */
const COLOR_STOPS: [number, string][] = [
  [0.00, '#6b0000'], [0.75, '#b03a00'], [0.85, '#b8a400'],
  [0.90, '#508060'], [0.95, '#28a030'], [1.00, '#00cc50'],
]

/** Maps an efficiency fraction (0–1) to an interpolated CSS colour string. */
export function effToColor(eff: number): string {
  const v = Math.max(0, Math.min(1, eff))
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [t0, c0] = COLOR_STOPS[i - 1], [t1, c1] = COLOR_STOPS[i]
    if (v <= t1) return interpolateRgb(c0, c1)((v - t0) / (t1 - t0))
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1][1]
}

/** Parameters returned by drawHeatmap for hit-testing on hover. */
export interface DrawParams {
  margin: { top: number; right: number; bottom: number; left: number }
  cellW: number; cellH: number; chartW: number; chartH: number
  data: EfficiencyMapResult
}

/** Draws the 10×10 efficiency cell grid. */
function drawCells(
  root: Selection<SVGGElement, unknown, null, undefined>,
  data: EfficiencyMapResult, cellW: number, cellH: number, N: number,
): void {
  for (let vi = 0; vi < N; vi++) {
    for (let ii = 0; ii < N; ii++) {
      root.append('rect')
        .attr('x', vi * cellW).attr('y', (N - 1 - ii) * cellH)
        .attr('width', cellW - 0.5).attr('height', cellH - 0.5)
        .attr('fill', effToColor(data.matrix[vi][ii]))
    }
  }
}

/** Appends the X/Y axes and their text labels. */
function drawAxesAndLabels(
  root: Selection<SVGGElement, unknown, null, undefined>,
  xD: [number, number], yD: [number, number], cW: number, cH: number,
): void {
  const xS = scaleLinear().domain(xD).range([0, cW])
  const yS = scaleLinear().domain(yD).range([cH, 0])

  const xG = root.append('g').attr('transform', `translate(0,${cH})`).call(axisBottom(xS).ticks(5).tickFormat((d) => `${d} V`))
  xG.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px')
  xG.selectAll('line,path').attr('stroke', 'var(--border)')
  const yG = root.append('g').call(axisLeft(yS).ticks(5).tickFormat((d) => `${(+d).toFixed(1)} A`))
  yG.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px')
  yG.selectAll('line,path').attr('stroke', 'var(--border)')

  root.append('text').attr('x', cW / 2).attr('y', cH + 40).attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('font-family', 'var(--font-ui)').text('Input Voltage Vin (V)')
  root.append('text').attr('transform', `translate(-42,${cH / 2}) rotate(-90)`).attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('font-family', 'var(--font-ui)').text('Output Current Iout (A)')
}

/** Draws the white crosshair at the nominal Vin / full Iout operating point. */
function drawCrosshair(
  root: Selection<SVGGElement, unknown, null, undefined>,
  spec: DesignSpec, xD: [number, number], yD: [number, number],
  cW: number, cH: number, cellW: number, cellH: number,
): void {
  const xS  = scaleLinear().domain(xD).range([0, cW])
  const yS  = scaleLinear().domain(yD).range([cH, 0])
  const nom = Math.max(xD[0], Math.min(xD[1], (spec.vinMin + spec.vinMax) / 2))
  const io  = Math.max(yD[0], Math.min(yD[1], spec.iout))
  const cx  = xS(nom), cy = yS(io), arm = Math.min(cellW, cellH) * 0.75

  const style = (sel: Selection<SVGLineElement, unknown, null, undefined>) =>
    sel.attr('stroke', 'white').attr('stroke-width', 1.5).attr('opacity', 0.9)
  style(root.append<SVGLineElement>('line').attr('x1', cx - arm).attr('x2', cx + arm).attr('y1', cy).attr('y2', cy))
  style(root.append<SVGLineElement>('line').attr('x1', cx).attr('x2', cx).attr('y1', cy - arm).attr('y2', cy + arm))
}

/** Draws the vertical legend bar with gradient and %-labelled axis. */
function drawLegend(
  svgSel: Selection<SVGSVGElement, unknown, null, undefined>,
  root: Selection<SVGGElement, unknown, null, undefined>,
  cW: number, cH: number,
): void {
  const defs = svgSel.append('defs')
  const grad = defs.append('linearGradient').attr('id', 'eff-map-grad').attr('x1', 0).attr('y1', 1).attr('x2', 0).attr('y2', 0)
  COLOR_STOPS.forEach(([stop, color]) => {
    grad.append('stop').attr('offset', `${(stop * 100).toFixed(0)}%`).attr('stop-color', color)
  })

  const lgX = cW + 22, lgW = 12
  root.append('rect').attr('x', lgX).attr('y', 0).attr('width', lgW).attr('height', cH).attr('rx', 2).attr('fill', 'url(#eff-map-grad)')
  const lgG = root.append('g').attr('transform', `translate(${lgX + lgW},0)`)
    .call(axisRight(scaleLinear().domain([0, 1]).range([cH, 0])).tickValues(COLOR_STOPS.map(([t]) => t)).tickFormat((d) => `${(+d * 100).toFixed(0)}%`))
  lgG.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '10px')
  lgG.selectAll('line,path').attr('stroke', 'var(--border)')
}

/**
 * Renders the 10×10 efficiency heatmap into the given SVG element.
 * Returns DrawParams for hover hit-testing, or null if the SVG has zero size.
 * @param svg  Target SVG element with non-zero client dimensions.
 * @param data Efficiency map result from the worker.
 * @param spec Design specification (used to position the crosshair).
 */
export function drawHeatmap(svg: SVGSVGElement, data: EfficiencyMapResult, spec: DesignSpec): DrawParams | null {
  const W = svg.clientWidth, H = svg.clientHeight
  if (!W || !H) return null
  const N = 10, margin = { top: 28, right: 90, bottom: 48, left: 58 }
  const cW = W - margin.left - margin.right, cH = H - margin.top - margin.bottom
  if (cW <= 0 || cH <= 0) return null
  const cellW = cW / N, cellH = cH / N

  const { vinPoints, ioutPoints } = data
  const vinSpan = vinPoints[N - 1] - vinPoints[0]
  const xD: [number, number] = vinSpan === 0 ? [vinPoints[0] - 0.5, vinPoints[0] + 0.5] : [vinPoints[0], vinPoints[N - 1]]
  const yD: [number, number] = [ioutPoints[0], ioutPoints[N - 1]]

  const svgSel = select(svg); svgSel.selectAll('*').remove()
  const root   = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  drawCells(root, data, cellW, cellH, N)
  drawAxesAndLabels(root, xD, yD, cW, cH)
  drawCrosshair(root, spec, xD, yD, cW, cH, cellW, cellH)
  drawLegend(svgSel, root, cW, cH)

  return { margin, cellW, cellH, chartW: cW, chartH: cH, data }
}
