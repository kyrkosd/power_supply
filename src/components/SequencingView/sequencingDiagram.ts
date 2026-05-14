// D3 timing diagram for power-sequencing analysis — pure rendering, no React.
import { select } from 'd3-selection'
import type { SequencingResult } from '../../engine/sequencing'
import { MARGIN, computeLayout } from './diagram/layout'
import { drawGridAndAxis } from './diagram/axes'
import { drawRailRow } from './diagram/rail'

function conflictedRailNames(warnings: string[]): Set<string> {
  const s = new Set<string>()
  for (const w of warnings) {
    const m = w.match(/Rail "([^"]+)" enables before "([^"]+)"/)
    if (m) { s.add(m[1]); s.add(m[2]) }
  }
  return s
}

export function drawDiagram(svg: SVGSVGElement, result: SequencingResult): void {
  const W = svg.clientWidth, H = svg.clientHeight
  if (!W || !H || result.rails.length === 0) return

  const N = result.rails.length
  const { cW, rowH, xScale } = computeLayout(W, H, N, result.total_time_ms)

  const svgSel = select(svg)
  svgSel.selectAll('*').remove()
  const root = svgSel.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  drawGridAndAxis(root, xScale, N, rowH)

  const conflicts = conflictedRailNames(result.warnings)
  result.rails.forEach((rail, i) => {
    drawRailRow(root, rail, i, i === N - 1, xScale, cW, rowH, conflicts.has(rail.name))
  })
}
