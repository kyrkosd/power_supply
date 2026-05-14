import { scaleLinear } from 'd3-scale'
import type { ScaleLinear } from 'd3-scale'

export type { ScaleLinear }

export const MARGIN = { top: 18, right: 24, bottom: 32, left: 110 } as const

export function computeLayout(W: number, H: number, railCount: number, totalTimeMs: number) {
  const cW   = W - MARGIN.left - MARGIN.right
  const cH   = H - MARGIN.top - MARGIN.bottom
  const rowH = Math.min(50, cH / railCount)
  const xScale = scaleLinear()
    .domain([0, Math.max(totalTimeMs * 1.08, 10)])
    .range([0, cW])
  return { cW, rowH, xScale }
}
