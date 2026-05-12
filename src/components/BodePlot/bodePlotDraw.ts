// D3 Bode plot rendering for the BodePlot component (plant, compensator, loop gain).
import { select } from 'd3-selection'
import { axisBottom, axisLeft, axisRight } from 'd3-axis'
import { scaleLog, scaleLinear } from 'd3-scale'
import { line, curveLinear } from 'd3-shape'
import { analyzeBuckControlLoop } from '../../engine/control-loop'
import type { BodePoint } from '../../engine/control-loop'
import type { DesignSpec, DesignResult } from '@engine/types'
import styles from './BodePlot.module.css'

/** Formats a frequency value as "10", "10k", or "1M". */
export function formatFrequency(value: number): string {
  if (value >= 1e6) return `${value / 1e6}M`
  if (value >= 1e3) return `${value / 1e3}k`
  return `${Math.round(value)}`
}

/** Builds log-frequency and linear magnitude/phase scales from the analysis data. */
function buildScales(spec: DesignSpec, analysis: ReturnType<typeof analyzeBuckControlLoop>, cW: number, cH: number) {
  const allMag = analysis.plant.map((p) => p.magnitude_db)
    .concat(analysis.compensator.map((p) => p.magnitude_db))
    .concat(analysis.loop.map((p) => p.magnitude_db))
  const magDomain = [
    Math.floor((Math.min(...allMag) - 20) / 20) * 20,
    Math.ceil((Math.max(...allMag) + 10) / 20) * 20,
  ] as [number, number]
  const phaseDomain = [
    Math.floor(Math.min(...analysis.loop.map((p) => p.phase_deg)) / 20) * 20,
    Math.ceil(Math.max(...analysis.loop.map((p) => p.phase_deg))  / 20) * 20,
  ] as [number, number]

  return {
    xScale:      scaleLog().base(10).domain([10, spec.fsw * 10]).range([0, cW]),
    yMagScale:   scaleLinear().domain(magDomain).range([cH, 0]).nice(),
    yPhaseScale: scaleLinear().domain(phaseDomain).range([cH, 0]).nice(),
  }
}

/** Appends the X (frequency), left (magnitude), and right (phase) axes to root. */
function drawAxes(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  scales: ReturnType<typeof buildScales>,
  spec: DesignSpec, cW: number, cH: number,
): void {
  const { xScale, yMagScale, yPhaseScale } = scales
  const ticks = Array.from({ length: Math.ceil(Math.log10(spec.fsw * 10)) }, (_, i) => 10 ** (i + 1))

  root.append('g').attr('class', styles.grid).attr('transform', `translate(0,${cH})`)
    .call(axisBottom(xScale).tickValues(ticks).tickSize(-cH).tickFormat(() => ''))
  root.append('g').attr('class', styles.grid)
    .call(axisLeft(yMagScale).ticks(6).tickSize(-cW).tickFormat(() => ''))

  root.append('g').attr('class', styles.axis).attr('transform', `translate(0,${cH})`)
    .call(axisBottom(xScale).tickValues(ticks).tickFormat((v) => formatFrequency(Number(v))))
    .selectAll('text').attr('fill', 'var(--text-muted)')
  root.append('g').attr('class', styles.axis)
    .call(axisLeft(yMagScale).ticks(6)).selectAll('text').attr('fill', 'var(--text-muted)')
  root.append('g').attr('class', styles.axis).attr('transform', `translate(${cW},0)`)
    .call(axisRight(yPhaseScale).ticks(7)).selectAll('text').attr('fill', 'var(--text-muted)')
}

/** Draws plant, compensator, and loop-gain magnitude curves. */
function drawCurves(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  analysis: ReturnType<typeof analyzeBuckControlLoop>,
  xScale: ReturnType<typeof scaleLog>,
  yMagScale: ReturnType<typeof scaleLinear>,
): void {
  const magLine = line<BodePoint>()
    .x((d) => xScale(d.freq_hz)).y((d) => yMagScale(d.magnitude_db)).curve(curveLinear)

  root.append('path').datum(analysis.plant)
    .attr('fill', 'none').attr('stroke', '#9b9b9b').attr('stroke-width', 1.5).attr('stroke-dasharray', '6 4').attr('d', magLine)
  root.append('path').datum(analysis.compensator)
    .attr('fill', 'none').attr('stroke', '#f2a700').attr('stroke-width', 1.5).attr('stroke-dasharray', '6 4').attr('d', magLine)
  root.append('path').datum(analysis.loop)
    .attr('fill', 'none').attr('stroke', '#36d7d1').attr('stroke-width', 2).attr('d', magLine)
}

/** Draws the crossover marker, slope-comp warning, and mode/margin labels. */
function drawAnnotations(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  analysis: ReturnType<typeof analyzeBuckControlLoop>,
  xScale: ReturnType<typeof scaleLog>,
  controlMode: string, cW: number, cH: number, margin: { top: number },
): void {
  const fcX = analysis.crossoverFrequencyHz
  if (!Number.isNaN(fcX)) {
    const x = xScale(fcX)
    root.append('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', cH)
      .attr('stroke', 'rgba(74,144,217,0.65)').attr('stroke-width', 1).attr('stroke-dasharray', '4 4')
    root.append('text').attr('x', x + 6).attr('y', 20)
      .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('font-family', 'Segoe UI')
      .text(`fc ≈ ${formatFrequency(fcX)} Hz`)
  }

  if (analysis.slopeCompensation.subharmonic_risk) {
    root.append('rect').attr('x', 0).attr('y', -margin.top).attr('width', cW).attr('height', margin.top - 4)
      .attr('fill', 'rgba(245,158,11,0.12)')
    root.append('text').attr('x', 4).attr('y', -margin.top + 13)
      .attr('fill', '#f59e0b').attr('font-size', '10px').attr('font-family', 'Segoe UI')
      .text('⚠ D > 50 % — slope compensation required to prevent fsw/2 subharmonic oscillation')
  }

  const modeLabel = controlMode === 'current' ? 'Current Mode (PCM)' : 'Voltage Mode (VMC)'
  root.append('text').attr('x', 0).attr('y', -8)
    .attr('fill', controlMode === 'current' ? '#36d7d1' : 'var(--text-secondary)')
    .attr('font-size', '11px').attr('font-family', 'Segoe UI')
    .text(`${modeLabel}  ·  Plant · Controller · Loop gain`)
  root.append('text').attr('x', 0).attr('y', cH + 34)
    .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('font-family', 'Segoe UI').text('Frequency (Hz)')
  root.append('text').attr('x', 0).attr('y', cH + 18)
    .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('font-family', 'Segoe UI')
    .text(`PM ${analysis.phaseMarginDeg.toFixed(0)}° · GM ${analysis.gainMarginDb.toFixed(1)} dB`)
}

/**
 * Renders the Bode plot (plant / compensator / loop gain) into the given SVG element.
 * @param svg    Target SVG element with non-zero client dimensions.
 * @param spec   Design specification providing fsw and controlMode.
 * @param result Engine result used by the control-loop analyser.
 */
export function drawBodePlot(svg: SVGSVGElement, spec: DesignSpec, result: DesignResult): void {
  const W = svg.clientWidth, H = svg.clientHeight
  if (!W || !H) return
  const margin = { top: 28, right: 80, bottom: 40, left: 56 }
  const cW = W - margin.left - margin.right, cH = H - margin.top - margin.bottom

  const controlMode = spec.controlMode ?? 'voltage'
  const analysis    = analyzeBuckControlLoop(spec, result, { controlMode })
  const scales      = buildScales(spec, analysis, cW, cH)

  const sel  = select(svg); sel.selectAll('*').remove()
  const root = sel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  drawAxes(root, scales, spec, cW, cH)
  drawCurves(root, analysis, scales.xScale, scales.yMagScale)
  drawAnnotations(root, analysis, scales.xScale, controlMode, cW, cH, margin)
}
