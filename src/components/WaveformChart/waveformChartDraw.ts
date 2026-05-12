// D3 multi-panel waveform chart renderer for the WaveformChart component.
import { select } from 'd3-selection'
import { axisBottom, axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { line, curveLinear } from 'd3-shape'
import { extent } from 'd3-array'
import type { WaveformSet } from '../../engine/topologies/types'
import type { DesignSpec } from '../../engine/types'
import styles from './WaveformChart.module.css'

/** Metadata for a single waveform panel (key into WaveformSet, display info). */
interface PanelMeta { key: keyof WaveformSet; label: string; unit: string; color: string }

/** Ordered list of waveform panels to render, top to bottom. */
const PANELS: PanelMeta[] = [
  { key: 'inductor_current', label: 'Inductor current',       unit: 'A', color: '#4adcf4' },
  { key: 'switch_node',      label: 'Switch node voltage',    unit: 'V', color: '#f4b400' },
  { key: 'output_ripple',    label: 'Output voltage ripple',  unit: 'V', color: '#f26f5c' },
  { key: 'diode_current',    label: 'Diode current',          unit: 'A', color: '#70c7ff' },
]

/** Builds a padded Y scale for a waveform panel's value range. */
function buildYScale(values: number[], rowH: number): ReturnType<typeof scaleLinear> {
  const [lo, hi] = extent(values) as [number, number]
  const d = hi - lo
  const pad = d === 0 ? 1 : d * 0.12
  return scaleLinear().domain([lo - pad, hi + pad]).range([rowH, 0]).nice()
}

/** Renders one waveform panel row (background, Y axis, label, path). */
function drawPanel(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  panel: PanelMeta, waveforms: WaveformSet,
  xScale: ReturnType<typeof scaleLinear>,
  rowH: number, rowY: number,
): void {
  const values = Array.from(waveforms[panel.key])
  const yScale = buildYScale(values, rowH)
  const row    = root.append('g').attr('transform', `translate(0,${rowY})`)

  row.append('rect').attr('width', xScale.range()[1]).attr('height', rowH).attr('fill', 'rgba(255,255,255,0.02)')
  row.append('g').attr('class', styles.yAxis).call(axisLeft(yScale).ticks(4).tickSize(-xScale.range()[1]).tickPadding(8))
    .selectAll('text').attr('fill', 'var(--text-muted)')
  row.append('text').attr('x', 0).attr('y', -8)
    .attr('fill', 'var(--text-primary)').attr('font-size', '11px').attr('font-weight', '600')
    .text(`${panel.label} (${panel.unit})`)

  const lineGen = line<number>()
    .x((_, i) => xScale(waveforms.time[i])).y((d) => yScale(d)).curve(curveLinear)
  row.append('path').datum(values)
    .attr('fill', 'none').attr('stroke', panel.color).attr('stroke-width', 2).attr('d', lineGen)
}

/** Appends the bottom time-axis to the last panel. */
function drawTimeAxis(
  root: ReturnType<typeof select<SVGGElement, unknown>>,
  xScale: ReturnType<typeof scaleLinear>,
  rowH: number, rowY: number, cW: number,
): void {
  const row = root.select<SVGGElement>(`g:nth-child(${PANELS.length + 1})`)
  row.append('g').attr('transform', `translate(0,${rowH})`).attr('class', styles.xAxis)
    .call(axisBottom(xScale).ticks(6).tickFormat((v) => `${(Number(v) * 1000).toFixed(1)} ms`))
    .selectAll('text').attr('fill', 'var(--text-muted)')
  row.append('text').attr('x', cW / 2).attr('y', rowH + 28)
    .attr('fill', 'var(--text-secondary)').attr('font-size', '11px').attr('text-anchor', 'middle').text('Time (ms)')
  void rowY // suppress unused-variable lint
}

/**
 * Renders four synchronized waveform panels into the given SVG element.
 * @param svg       Target SVG element with non-zero client dimensions.
 * @param waveforms Waveform data from the buck topology engine.
 * @param spec      Design specification providing fsw for the title label.
 */
export function drawWaveformChart(svg: SVGSVGElement, waveforms: WaveformSet, spec: DesignSpec): void {
  const W = svg.clientWidth, H = svg.clientHeight
  if (!W || !H) return
  const m   = { top: 20, right: 18, bottom: 32, left: 52 }
  const cW  = W - m.left - m.right, cH = H - m.top - m.bottom
  const gap = 12, rowH = (cH - (PANELS.length - 1) * gap) / PANELS.length

  const xScale = scaleLinear().domain(extent(waveforms.time) as [number, number]).range([0, cW])
  const sel    = select(svg); sel.selectAll('*').remove()
  const root   = sel.append('g').attr('transform', `translate(${m.left},${m.top})`)

  PANELS.forEach((panel, i) => {
    drawPanel(root, panel, waveforms, xScale, rowH, i * (rowH + gap))
  })
  drawTimeAxis(root, xScale, rowH, (PANELS.length - 1) * (rowH + gap), cW)

  root.append('text').attr('x', 0).attr('y', -8)
    .attr('fill', 'var(--text-muted)').attr('font-size', '11px')
    .text(`Waveforms · 2 cycles @ ${Math.round(spec.fsw / 1000)} kHz`)
}
