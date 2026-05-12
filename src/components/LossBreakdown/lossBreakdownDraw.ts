// D3 efficiency-vs-load curve renderer for the LossBreakdown component.
import { select } from 'd3-selection'
import { axisBottom, axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { max, min } from 'd3-array'
import type { EffPoint } from './lossBreakdownEngine'
import styles from './LossBreakdown.module.css'

/** All curve data and metadata required to render the efficiency chart. */
export interface CurveSet {
  primary:  EffPoint[]
  nPhase:   EffPoint[]
  altRect:  EffPoint[]
  opPoint:  { loadCurrent: number; efficiency: number } | null
  isSync:   boolean
  nPhases:  number
}

/** Appends axis groups to root and returns the D3 line generator for EffPoints. */
function setupAxes(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  xS: ReturnType<typeof scaleLinear>,
  yS: ReturnType<typeof scaleLinear>,
  cH: number,
) {
  root.append('g').attr('class', styles.xAxis).attr('transform', `translate(0,${cH})`)
    .call(axisBottom(xS).ticks(6).tickFormat((v) => `${Number(v).toFixed(2)} A`))
    .selectAll('text').attr('fill', 'var(--text-muted)')
  root.append('g').attr('class', styles.yAxis)
    .call(axisLeft(yS).ticks(6).tickFormat((v) => `${Number(v).toFixed(0)}%`))
    .selectAll('text').attr('fill', 'var(--text-muted)')
}

/** Appends a legend entry (coloured line + label) at the current legendY position. */
function addLegendEntry(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  lgX: number, lgY: number,
  stroke: string, dash: string | null, w: number, label: string,
): number {
  root.append('line').attr('x1', lgX).attr('x2', lgX + 20)
    .attr('y1', lgY).attr('y2', lgY)
    .attr('stroke', stroke).attr('stroke-width', w).attr('stroke-dasharray', dash ?? '')
  root.append('text').attr('x', lgX + 24).attr('y', lgY + 4)
    .attr('fill', 'var(--text-muted)').attr('font-size', '10px').text(label)
  return lgY + 14
}

/** Draws the reference curves (alt-rectification dashed, n-phase baseline) onto root. */
function drawReferenceCurves(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  curves: CurveSet,
  mkLine: ReturnType<typeof line<EffPoint>>,
  lgX: number, lgY: number,
): number {
  if (curves.altRect.length > 0) {
    root.append('path').datum(curves.altRect).attr('fill', 'none').attr('stroke', '#d9382f')
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3').attr('d', mkLine)
    lgY = addLegendEntry(root, lgX, lgY, '#d9382f', '4 3', 1.5, curves.isSync ? 'Diode' : 'Sync')
  }
  if (curves.nPhase.length > 0) {
    root.append('path').datum(curves.primary).attr('fill', 'none').attr('stroke', '#64748b')
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3').attr('d', mkLine)
    lgY = addLegendEntry(root, lgX, lgY, '#64748b', '4 3', 1.5, '1-phase')
  }
  return lgY
}

/** Draws the primary efficiency curve and operating-point marker. */
function drawPrimaryAndMarker(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  curves: CurveSet,
  xS: ReturnType<typeof scaleLinear>,
  yS: ReturnType<typeof scaleLinear>,
  mkLine: ReturnType<typeof line<EffPoint>>,
  lgX: number, lgY: number,
): void {
  const activeCurve = curves.nPhase.length > 0 ? curves.nPhase : curves.primary
  root.append('path').datum(activeCurve).attr('fill', 'none').attr('stroke', '#32c9e6')
    .attr('stroke-width', 2.5).attr('d', mkLine)
  const label = curves.nPhase.length > 0
    ? `${curves.nPhases}-phase${curves.isSync ? ' sync' : ''}`
    : (curves.isSync ? 'Sync FET' : 'Diode')
  addLegendEntry(root, lgX, lgY, '#32c9e6', null, 2.5, label)

  if (curves.opPoint) {
    const opEff = activeCurve[activeCurve.length - 1]?.efficiency ?? curves.opPoint.efficiency
    root.append('circle')
      .attr('cx', xS(curves.opPoint.loadCurrent)).attr('cy', yS(opEff))
      .attr('r', 5).attr('fill', '#00f2ff').attr('stroke', '#ffffff').attr('stroke-width', 1.5)
    root.append('text')
      .attr('x', xS(curves.opPoint.loadCurrent) + 8).attr('y', yS(opEff) - 8)
      .attr('fill', 'var(--text-primary)').attr('font-size', '11px').text('Current load')
  }
}

/**
 * Renders the efficiency-vs-load D3 chart into the given SVG element.
 * @param svg    Target SVG element (must have non-zero clientWidth/Height).
 * @param curves Curve data including primary, nPhase, altRect, and operating point.
 */
export function drawEfficiencyCurve(svg: SVGSVGElement, curves: CurveSet): void {
  const W = svg.clientWidth, H = svg.clientHeight
  if (!W || !H || curves.primary.length === 0) return
  const m = { top: 18, right: 18, bottom: 34, left: 52 }
  const cW = W - m.left - m.right, cH = H - m.top - m.bottom

  const all = [...curves.primary, ...curves.nPhase, ...curves.altRect]
  const xD: [number, number] = [curves.primary[0].loadCurrent, curves.primary[curves.primary.length - 1].loadCurrent]
  const yD: [number, number] = [
    Math.max(0, min(all, (d) => d.efficiency)! - 2),
    Math.min(100, max(all, (d) => d.efficiency)! + 2),
  ]
  const xS = scaleLinear().domain(xD).range([0, cW]).nice()
  const yS = scaleLinear().domain(yD).range([cH, 0]).nice()

  const sel = select(svg); sel.selectAll('*').remove()
  const root = sel.append('g').attr('transform', `translate(${m.left},${m.top})`)
  setupAxes(root, xS, yS, cH)

  const mkLine = line<EffPoint>().x((d) => xS(d.loadCurrent)).y((d) => yS(d.efficiency)).curve(curveMonotoneX)
  const lgX = cW - 140
  const lgY = drawReferenceCurves(root, curves, mkLine, lgX, 6)
  drawPrimaryAndMarker(root, curves, xS, yS, mkLine, lgX, lgY)

  root.append('text').attr('x', 0).attr('y', -8)
    .attr('fill', 'var(--text-muted)').attr('font-size', '11px').text('Efficiency vs Load')
}
