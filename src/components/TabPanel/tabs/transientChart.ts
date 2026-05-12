// D3 waveform renderer for the Transient simulation tab.
// Pure function — no React dependencies; called by ChartPanel via useEffect.

import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { line } from 'd3-shape'
import { extent } from 'd3-array'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Describes a single transient chart panel's data and rendering properties.
 * One `PanelCfg` maps to one SVG element (one waveform track).
 */
export interface PanelCfg {
  /** Signal samples aligned to the shared time axis, one value per step. */
  data: Float64Array
  /** Human-readable signal name shown on the y-axis label. */
  label: string
  /** Physical unit appended to the axis label (V, A, …). */
  unit: string
  /** CSS/SVG colour string for the trace line. */
  color: string
  /** Optional horizontal dashed reference line value (e.g. target Vout). */
  refLine?: number
}

// ── Chart rendering ───────────────────────────────────────────────────────────

/**
 * Renders a single time-domain waveform panel into an SVG element.
 *
 * Clears any prior content, then draws: an optional dashed reference line,
 * the signal trace, and bottom/left axes with engineering-friendly tick formats.
 * No-op when `svg` has zero dimensions (e.g. during hidden-tab renders).
 *
 * @param svg   SVG element to render into (must have non-zero clientWidth/Height).
 * @param time  Time-axis samples in seconds.
 * @param panel Data and display configuration.
 */
export function drawChart(svg: SVGSVGElement, time: Float64Array, panel: PanelCfg): void {
  const W = svg.clientWidth
  const H = svg.clientHeight
  if (!W || !H) return

  const margin = { top: 14, right: 14, bottom: 28, left: 52 }
  const cW = W - margin.left - margin.right
  const cH = H - margin.top - margin.bottom
  if (cW <= 0 || cH <= 0) return

  const tMs = Array.from(time, (t) => t * 1000)
  const vals = Array.from(panel.data)

  const xDom = extent(tMs) as [number, number]
  const yExt = extent(vals) as [number, number]
  const pad  = (yExt[1] - yExt[0]) * 0.12 || 0.1
  const yDom: [number, number] = [yExt[0] - pad, yExt[1] + pad]

  const xScale = scaleLinear().domain(xDom).range([0, cW])
  const yScale = scaleLinear().domain(yDom).range([cH, 0])

  const svgSel = select(svg)
  svgSel.selectAll('*').remove()

  const root = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Dashed reference line (e.g. target Vout)
  if (panel.refLine !== undefined) {
    root.append('line')
      .attr('x1', 0).attr('x2', cW)
      .attr('y1', yScale(panel.refLine)).attr('y2', yScale(panel.refLine))
      .attr('stroke', 'rgba(255,255,255,0.18)')
      .attr('stroke-dasharray', '4 3')
      .attr('stroke-width', 1)
  }

  // Signal trace
  const pathGen = line<number>()
    .x((_, i) => xScale(tMs[i]))
    .y((v)    => yScale(v))
    .defined((_, i) => isFinite(vals[i]))

  root.append('path')
    .datum(vals)
    .attr('fill', 'none')
    .attr('stroke', panel.color)
    .attr('stroke-width', 1.5)
    .attr('d', pathGen as unknown as string)

  // Axes
  const xAxis = axisBottom(xScale).ticks(5).tickFormat((d) => `${d} ms`)
  const yAxis = axisLeft(yScale).ticks(4)

  const xGrp = root.append('g').attr('transform', `translate(0,${cH})`).call(xAxis)
  xGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  xGrp.selectAll('line,path').attr('stroke', 'var(--border)')

  const yGrp = root.append('g').call(yAxis)
  yGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  yGrp.selectAll('line,path').attr('stroke', 'var(--border)')

  // Y-axis label
  root.append('text')
    .attr('transform', `translate(-38,${cH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text-muted)')
    .attr('font-size', '9px')
    .attr('font-family', 'var(--font-ui)')
    .text(`${panel.label} (${panel.unit})`)
}
