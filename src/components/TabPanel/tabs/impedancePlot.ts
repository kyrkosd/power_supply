// D3 log-log impedance Bode plot renderer for the Input Filter tab.
// Pure function — no React dependencies; called by ImpedancePlot component via useEffect.

import { select } from 'd3-selection'
import { scaleLog } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { line } from 'd3-shape'
import {
  filterOutputImpedance,
  converterInputImpedance,
} from '../../../engine/input-filter'
import type { InputFilterResult } from '../../../engine/input-filter'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Number of frequency points on the log-swept horizontal axis. */
const FREQ_POINTS = 200

/** Returns `n` logarithmically-spaced values between `fMin` and `fMax`. */
function logspace(fMin: number, fMax: number, n: number): number[] {
  const lo = Math.log10(fMin)
  const hi = Math.log10(fMax)
  return Array.from({ length: n }, (_, i) => Math.pow(10, lo + (hi - lo) * (i / (n - 1))))
}

// ── Impedance plot ────────────────────────────────────────────────────────────

/**
 * Renders a log-log impedance Bode plot showing:
 *  - |Zout| of the DM filter (green)
 *  - |Zin| of the converter (blue)
 *  - Middlebrook stability boundary |Zin|/3 (red dashed)
 *  - Violation shading where |Zout| > |Zin|/3
 *  - fsw and filter resonance frequency markers
 *
 * No-op when `svg` has zero dimensions.
 *
 * @param svg    SVG element to render into.
 * @param filter Computed input-filter result carrying component values.
 * @param fsw    Switching frequency in Hz (used for the fsw marker line).
 */
export function drawImpedancePlot(
  svg: SVGSVGElement,
  filter: InputFilterResult,
  fsw: number,
): void {
  const W = svg.clientWidth
  const H = svg.clientHeight
  if (!W || !H) return

  const margin = { top: 16, right: 24, bottom: 40, left: 62 }
  const cW = W - margin.left - margin.right
  const cH = H - margin.top - margin.bottom
  if (cW <= 0 || cH <= 0) return

  const freqs = logspace(100, Math.min(30e6, fsw * 10), FREQ_POINTS)

  const zOut = filterOutputImpedance(
    filter.dm_inductor,
    filter.dm_capacitor,
    filter.damping_resistor,
    filter.damping_capacitor,
    freqs,
  )
  const zIn    = converterInputImpedance(filter.negative_input_impedance, fsw, freqs)
  const zBound = zIn.map((z) => z / 3)   // tightened Middlebrook criterion

  const allZ = [...zOut, ...zIn, ...zBound].filter(isFinite).filter((v) => v > 0)
  const yMin = Math.min(...allZ) * 0.5
  const yMax = Math.max(...allZ) * 2

  const xScale = scaleLog().domain([freqs[0], freqs[freqs.length - 1]]).range([0, cW])
  const yScale = scaleLog().domain([Math.max(1e-3, yMin), yMax]).range([cH, 0]).clamp(true)

  const svgSel = select(svg)
  svgSel.selectAll('*').remove()
  const root = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Horizontal grid lines
  root.append('g')
    .selectAll('line.h')
    .data(yScale.ticks(5))
    .enter().append('line')
    .attr('x1', 0).attr('x2', cW)
    .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
    .attr('stroke', 'var(--border)').attr('stroke-width', 0.5)

  // Red shading where |Zout| violates the Middlebrook boundary
  for (let i = 0; i < freqs.length - 1; i++) {
    if (zOut[i] > zBound[i]) {
      root.append('rect')
        .attr('x', xScale(freqs[i]))
        .attr('y', 0)
        .attr('width', xScale(freqs[i + 1]) - xScale(freqs[i]))
        .attr('height', cH)
        .attr('fill', 'rgba(239,68,68,0.08)')
    }
  }

  // Helper: draw one data series as a path
  const mkLine = (data: number[], color: string, dash?: string) => {
    const pathGen = line<number>()
      .x((_, i) => xScale(freqs[i]))
      .y((v)    => yScale(Math.max(1e-6, v)))
      .defined((v) => isFinite(v) && v > 0)

    const path = root.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('d', pathGen as unknown as string)
    if (dash) path.attr('stroke-dasharray', dash)
  }

  mkLine(zBound, 'rgba(239,68,68,0.55)', '4 3')
  mkLine(zIn,    '#60a5fa')
  mkLine(zOut,   '#4ade80')

  // Switching frequency marker
  if (fsw >= freqs[0] && fsw <= freqs[freqs.length - 1]) {
    root.append('line')
      .attr('x1', xScale(fsw)).attr('x2', xScale(fsw))
      .attr('y1', 0).attr('y2', cH)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-dasharray', '4 3')
      .attr('stroke-width', 1)
    root.append('text')
      .attr('x', xScale(fsw) + 3).attr('y', 10)
      .attr('fill', 'var(--text-muted)').attr('font-size', '9px')
      .attr('font-family', 'var(--font-ui)')
      .text('fsw')
  }

  // Filter resonance frequency marker
  const fres = filter.filter_resonant_freq
  if (fres >= freqs[0] && fres <= freqs[freqs.length - 1]) {
    root.append('line')
      .attr('x1', xScale(fres)).attr('x2', xScale(fres))
      .attr('y1', 0).attr('y2', cH)
      .attr('stroke', 'rgba(74,220,128,0.35)')
      .attr('stroke-dasharray', '2 3')
      .attr('stroke-width', 1)
    root.append('text')
      .attr('x', xScale(fres) + 3).attr('y', 22)
      .attr('fill', 'var(--text-muted)').attr('font-size', '9px')
      .attr('font-family', 'var(--font-ui)')
      .text('fres')
  }

  // Axes — compact tick labels for log axes
  const fmtHzAxis = (d: d3.NumberValue) => {
    const v = +d
    if (v >= 1e6) return `${v / 1e6}M`
    if (v >= 1e3) return `${v / 1e3}k`
    return `${v}`
  }
  const xAxis = axisBottom(xScale).ticks(6, fmtHzAxis)
  const yAxis = axisLeft(yScale).ticks(5, (d: d3.NumberValue) => {
    const v = +d
    if (v >= 1e3) return `${v / 1e3}k`
    if (v < 1) return v.toFixed(2)
    return `${v.toFixed(0)}`
  })

  const xGrp = root.append('g').attr('transform', `translate(0,${cH})`).call(xAxis)
  xGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  xGrp.selectAll('line,path').attr('stroke', 'var(--border)')
  xGrp.append('text')
    .attr('x', cW / 2).attr('y', 34).attr('fill', 'var(--text-muted)')
    .attr('font-size', '9px').attr('font-family', 'var(--font-ui)')
    .attr('text-anchor', 'middle').text('Frequency (Hz)')

  const yGrp = root.append('g').call(yAxis)
  yGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  yGrp.selectAll('line,path').attr('stroke', 'var(--border)')
  yGrp.append('text')
    .attr('transform', `translate(-50,${cH / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)')
    .attr('font-size', '9px').attr('font-family', 'var(--font-ui)')
    .text('Impedance (Ω)')
}
