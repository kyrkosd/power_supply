// D3 timing diagram for power-sequencing analysis — pure rendering, no React.
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import type { SequencingResult } from '../../engine/sequencing'

// ── Colors ────────────────────────────────────────────────────────────────────

const ENABLE_COLOR   = '#4adcf4'
const SETTLING_COLOR = 'rgba(74,220,244,0.45)'
const PG_COLOR       = '#4ade80'
const WARN_COLOR     = '#f59e0b'

// ── Helper ────────────────────────────────────────────────────────────────────

/** Extracts rail names involved in conflict warnings for highlight rendering. */
function conflictedRailNames(warnings: string[]): Set<string> {
  const s = new Set<string>()
  for (const w of warnings) {
    const m = w.match(/Rail "([^"]+)" enables before "([^"]+)"/)
    if (m) { s.add(m[1]); s.add(m[2]) }
  }
  return s
}

// ── Main draw function ────────────────────────────────────────────────────────

/**
 * Renders the power-sequencing timing diagram into `svg`.
 * Clears and redraws on every call; safe to call on every state change.
 * Each rail row shows: enable ramp, settling zone, PG marker, and steady state.
 */
export function drawDiagram(svg: SVGSVGElement, result: SequencingResult): void {
  const W = svg.clientWidth
  const H = svg.clientHeight
  if (!W || !H || result.rails.length === 0) return

  const N      = result.rails.length
  const margin = { top: 18, right: 24, bottom: 32, left: 110 }
  const cW     = W - margin.left - margin.right
  const cH     = H - margin.top - margin.bottom
  const rowH   = Math.min(50, cH / N)
  const pad    = 6

  const maxTime = Math.max(result.total_time_ms * 1.08, 10)
  const xScale  = scaleLinear().domain([0, maxTime]).range([0, cW])

  const svgSel = select(svg)
  svgSel.selectAll('*').remove()

  const root = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Grid lines
  root.append('g')
    .attr('transform', `translate(0,${N * rowH})`)
    .call(axisBottom(xScale).ticks(6).tickSize(-(N * rowH)).tickFormat(() => ''))
    .call((g) => {
      g.selectAll('line').attr('stroke', 'rgba(255,255,255,0.05)')
      g.select('.domain').remove()
    })

  // X axis
  const xAxis = axisBottom(xScale).ticks(6).tickFormat((d) => `${(+d).toFixed(1)} ms`)
  const xGrp  = root.append('g').attr('transform', `translate(0,${N * rowH})`).call(xAxis)
  xGrp.selectAll('text').attr('fill', 'var(--text-muted)').attr('font-size', '9px')
  xGrp.selectAll('line,path').attr('stroke', 'var(--border)')

  const conflicts = conflictedRailNames(result.warnings)

  result.rails.forEach((rail, i) => {
    const yTop  = i * rowH + pad
    const yBot  = (i + 1) * rowH - pad
    const midY  = (yTop + yBot) / 2
    const isConflict = conflicts.has(rail.name)
    const color = isConflict ? WARN_COLOR : ENABLE_COLOR

    // Rail name label
    root.append('text')
      .attr('x', -8).attr('y', midY + 3).attr('text-anchor', 'end')
      .attr('fill', isConflict ? WARN_COLOR : 'var(--text-secondary)')
      .attr('font-size', '10px').attr('font-family', 'var(--font-mono)')
      .attr('font-weight', isConflict ? 700 : 400)
      .text(rail.name)

    // Vout badge
    root.append('text')
      .attr('x', -8).attr('y', midY + 13).attr('text-anchor', 'end')
      .attr('fill', 'var(--text-muted)').attr('font-size', '8px').attr('font-family', 'var(--font-mono)')
      .text(`${rail.vout} V`)

    const enableX  = xScale(rail.enable_time_ms)
    const rampEndX = xScale(rail.enable_time_ms + rail.tss * 1000)
    const pgX      = xScale(rail.pg_time_ms)

    // Pre-enable dashed flat line
    if (enableX > 1) {
      root.append('line')
        .attr('x1', 0).attr('x2', enableX).attr('y1', yBot).attr('y2', yBot)
        .attr('stroke', color).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3 3').attr('opacity', 0.4)
    }

    // Rising ramp: enable → ramp end
    const rampEnd = Math.min(rampEndX, pgX)
    root.append('line')
      .attr('x1', enableX).attr('x2', rampEnd).attr('y1', yBot).attr('y2', yTop)
      .attr('stroke', color).attr('stroke-width', 1.5)

    // Settling zone: ramp end → PG (not yet stable)
    if (pgX > rampEndX) {
      root.append('line')
        .attr('x1', rampEndX).attr('x2', pgX).attr('y1', yTop).attr('y2', yTop)
        .attr('stroke', SETTLING_COLOR).attr('stroke-width', 1.5).attr('stroke-dasharray', '4 2')
    }

    // Post-PG steady state
    if (pgX < cW) {
      root.append('line')
        .attr('x1', pgX).attr('x2', cW).attr('y1', yTop).attr('y2', yTop)
        .attr('stroke', color).attr('stroke-width', 2)
    }

    // PG marker (dashed vertical)
    root.append('line')
      .attr('x1', pgX).attr('x2', pgX).attr('y1', yTop - 3).attr('y2', yBot + 3)
      .attr('stroke', PG_COLOR).attr('stroke-width', 1.5).attr('stroke-dasharray', '3 2')

    // PG label
    root.append('text')
      .attr('x', pgX + 3).attr('y', yTop + 8)
      .attr('fill', PG_COLOR).attr('font-size', '8px').attr('font-family', 'var(--font-ui)')
      .text('PG')

    // Row separator
    if (i < N - 1) {
      root.append('line')
        .attr('x1', 0).attr('x2', cW)
        .attr('y1', (i + 1) * rowH).attr('y2', (i + 1) * rowH)
        .attr('stroke', 'var(--border)').attr('stroke-width', 0.5)
    }
  })
}
