// D3 histogram rendering for the Monte Carlo distribution histograms.
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { max } from 'd3-array'
import type { MCDistribution } from '../../engine/monte-carlo'

/** Configuration for a single histogram panel. */
export interface HistConfig {
  title:        string
  limit:        number
  isUpperLimit: boolean
  multiplier:   number
  unit:         string
}

/** Fixed SVG viewport dimensions used for all histogram panels. */
const W = 360, H = 200
const M = { top: 28, right: 14, bottom: 36, left: 40 }
const IW = W - M.left - M.right
const IH = H - M.top  - M.bottom

/** Draws the background rect and pass/fail-coloured bin bars. */
function drawBins(
  g: ReturnType<typeof select<SVGGElement, unknown>>,
  data: MCDistribution, cfg: HistConfig,
  x: ReturnType<typeof scaleLinear>, y: ReturnType<typeof scaleLinear>,
): void {
  g.append('rect').attr('width', IW).attr('height', IH).attr('fill', 'rgba(255,255,255,0.02)')
  const binW = IW / (data.histogram.length || 1)
  g.selectAll('rect.bin').data(data.histogram).enter().append('rect')
    .attr('class', 'bin')
    .attr('x',      (d) => x(d.bin_center * cfg.multiplier) - binW / 2)
    .attr('y',      (d) => y(d.count))
    .attr('width',  Math.max(1, binW * 0.88))
    .attr('height', (d) => Math.max(0, IH - y(d.count)))
    .attr('fill',   (d) => {
      const fail = cfg.isUpperLimit ? d.bin_center > cfg.limit : d.bin_center < cfg.limit
      return fail ? '#f87171' : '#4ade80'
    })
}

/** Draws the spec-limit dashed line and p5/p95 percentile tick marks. */
function drawMarkers(
  g: ReturnType<typeof select<SVGGElement, unknown>>,
  data: MCDistribution, cfg: HistConfig,
  x: ReturnType<typeof scaleLinear>,
): void {
  const lx = x(cfg.limit * cfg.multiplier)
  g.append('line').attr('x1', lx).attr('x2', lx).attr('y1', 0).attr('y2', IH)
    .attr('stroke', '#f87171').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3')

  for (const [val, label] of [[data.p5, 'p5'], [data.p95, 'p95']] as [number, string][]) {
    const px = x(val * cfg.multiplier)
    g.append('line').attr('x1', px).attr('x2', px).attr('y1', IH).attr('y2', IH + 5)
      .attr('stroke', 'var(--text-muted)').attr('stroke-width', 1)
    g.append('text').attr('x', px).attr('y', IH + 22).attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)').style('font-size', '9px')
      .text(`${label}: ${(val * cfg.multiplier).toFixed(1)}${cfg.unit}`)
  }
}

/** Appends compact X and Y axes to the histogram group. */
function drawHistAxes(
  g: ReturnType<typeof select<SVGGElement, unknown>>,
  x: ReturnType<typeof scaleLinear>, y: ReturnType<typeof scaleLinear>,
  cfg: HistConfig,
): void {
  g.append('g').attr('transform', `translate(0,${IH})`)
    .call(axisBottom(x).ticks(4).tickFormat((d) => `${(+d).toFixed(1)}${cfg.unit}`))
    .attr('color', 'var(--text-muted)').selectAll('text').style('font-size', '9px')
  g.append('g').call(axisLeft(y).ticks(3))
    .attr('color', 'var(--text-muted)').selectAll('text').style('font-size', '9px')
}

/**
 * Renders a distribution histogram with pass/fail colouring into the given SVG.
 * @param svg  Target SVG element (must be mounted in the DOM).
 * @param data Distribution produced by the Monte Carlo engine.
 * @param cfg  Display configuration: spec limit, scale multiplier, unit label.
 */
export function drawHistogram(svg: SVGSVGElement, data: MCDistribution, cfg: HistConfig): void {
  const scaledMin   = data.min  * cfg.multiplier
  const scaledMax   = data.max  * cfg.multiplier
  const scaledLimit = cfg.limit * cfg.multiplier
  const span = scaledMax - scaledMin || 1, pad = span * 0.06

  const xDomain = [
    Math.min(scaledMin - pad, cfg.isUpperLimit ? scaledMin - pad : scaledLimit - pad),
    Math.max(scaledMax + pad, cfg.isUpperLimit ? scaledLimit + pad : scaledMax + pad),
  ]
  const x = scaleLinear().domain(xDomain).range([0, IW])
  const y = scaleLinear().domain([0, max(data.histogram, (d) => d.count) ?? 10]).nice().range([IH, 0])

  const root = select(svg); root.selectAll('*').remove(); root.attr('viewBox', `0 0 ${W} ${H}`)
  const g = root.append('g').attr('transform', `translate(${M.left},${M.top})`)
  drawBins(g, data, cfg, x, y)
  drawMarkers(g, data, cfg, x)
  drawHistAxes(g, x, y, cfg)

  root.append('text').attr('x', M.left + IW / 2).attr('y', 16)
    .attr('text-anchor', 'middle').attr('fill', 'var(--text-secondary)')
    .style('font-size', '11px').style('font-weight', '600').text(cfg.title)
}

/** Returns true when a distribution is valid and contains at least one value. */
export function isValidDist(data: MCDistribution | undefined): boolean {
  return !!data && data.values.length > 0 && !Number.isNaN(data.mean)
}
