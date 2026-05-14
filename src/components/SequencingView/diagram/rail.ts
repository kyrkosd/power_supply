import type { Selection } from 'd3-selection'
import type { ScaleLinear } from 'd3-scale'
import type { RailTiming } from '../../../engine/sequencing'
import { ENABLE_COLOR, SETTLING_COLOR, PG_COLOR, WARN_COLOR } from './constants'

type G = Selection<SVGGElement, unknown, null, undefined>

export function drawRailRow(
  root: G,
  rail: RailTiming,
  i: number,
  isLast: boolean,
  xScale: ScaleLinear<number, number>,
  cW: number,
  rowH: number,
  isConflict: boolean,
): void {
  const pad = 6
  const yTop = i * rowH + pad
  const yBot = (i + 1) * rowH - pad
  const midY = (yTop + yBot) / 2
  const color = isConflict ? WARN_COLOR : ENABLE_COLOR

  root.append('text')
    .attr('x', -8).attr('y', midY + 3).attr('text-anchor', 'end')
    .attr('fill', isConflict ? WARN_COLOR : 'var(--text-secondary)')
    .attr('font-size', '10px').attr('font-family', 'var(--font-mono)')
    .attr('font-weight', isConflict ? 700 : 400)
    .text(rail.name)

  root.append('text')
    .attr('x', -8).attr('y', midY + 13).attr('text-anchor', 'end')
    .attr('fill', 'var(--text-muted)').attr('font-size', '8px').attr('font-family', 'var(--font-mono)')
    .text(`${rail.vout} V`)

  const enableX  = xScale(rail.enable_time_ms)
  const rampEndX = xScale(rail.enable_time_ms + rail.tss * 1000)
  const pgX      = xScale(rail.pg_time_ms)

  if (enableX > 1)
    root.append('line').attr('x1', 0).attr('x2', enableX).attr('y1', yBot).attr('y2', yBot)
      .attr('stroke', color).attr('stroke-width', 1.5).attr('stroke-dasharray', '3 3').attr('opacity', 0.4)

  root.append('line').attr('x1', enableX).attr('x2', Math.min(rampEndX, pgX)).attr('y1', yBot).attr('y2', yTop)
    .attr('stroke', color).attr('stroke-width', 1.5)

  if (pgX > rampEndX)
    root.append('line').attr('x1', rampEndX).attr('x2', pgX).attr('y1', yTop).attr('y2', yTop)
      .attr('stroke', SETTLING_COLOR).attr('stroke-width', 1.5).attr('stroke-dasharray', '4 2')

  if (pgX < cW)
    root.append('line').attr('x1', pgX).attr('x2', cW).attr('y1', yTop).attr('y2', yTop)
      .attr('stroke', color).attr('stroke-width', 2)

  root.append('line').attr('x1', pgX).attr('x2', pgX).attr('y1', yTop - 3).attr('y2', yBot + 3)
    .attr('stroke', PG_COLOR).attr('stroke-width', 1.5).attr('stroke-dasharray', '3 2')

  root.append('text').attr('x', pgX + 3).attr('y', yTop + 8)
    .attr('fill', PG_COLOR).attr('font-size', '8px').attr('font-family', 'var(--font-ui)').text('PG')

  if (!isLast)
    root.append('line').attr('x1', 0).attr('x2', cW).attr('y1', (i + 1) * rowH).attr('y2', (i + 1) * rowH)
      .attr('stroke', 'var(--border)').attr('stroke-width', 0.5)
}
