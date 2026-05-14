import type { EquationEntry } from '../../../engine/equation-metadata'

export interface PlotGeometry {
  pts:      Array<{ x: number; y: number }>
  yMin:     number
  yMax:     number
  minDisplay: number
  maxDisplay: number
  tx:       (x: number) => number
  ty:       (y: number) => number
  opX:      number
  opY:      number | null
}

export const SVG_W = 372, SVG_H = 140
export const M = { top: 12, right: 12, bottom: 28, left: 52 }
export const CW = SVG_W - M.left - M.right   // 308
export const CH = SVG_H - M.top - M.bottom   // 100

export function fmtAxis(v: number): string {
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}k`
  if (Math.abs(v) >= 1)   return v.toFixed(1)
  return v.toFixed(3)
}

export function computePlotGeometry(
  entry: EquationEntry,
  vars: Record<string, number>,
  activeKey: string,
): PlotGeometry | null {
  const activeVar = entry.variables.find((v) => v.key === activeKey)
  if (!activeVar) return null

  const cw = SVG_W - M.left - M.right
  const ch = SVG_H - M.top - M.bottom
  const minDisplay = activeVar.min, maxDisplay = activeVar.max
  const minSI = minDisplay / activeVar.displayScale
  const maxSI = maxDisplay / activeVar.displayScale

  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < 60; i++) {
    const xSI = minSI + (maxSI - minSI) * (i / 59)
    const ySI = entry.evaluate({ ...vars, [activeKey]: xSI })
    if (Number.isFinite(ySI) && ySI >= 0)
      pts.push({ x: xSI * activeVar.displayScale, y: ySI * entry.displayScale })
  }
  if (pts.length < 2) return null

  const yVals  = pts.map((p) => p.y)
  const rawMin = Math.min(...yVals), rawMax = Math.max(...yVals)
  const yPad   = (rawMax - rawMin) * 0.08 || rawMax * 0.1 || 0.01
  const yMin   = Math.max(0, rawMin - yPad), yMax = rawMax + yPad

  const tx = (x: number) => M.left + ((x - minDisplay) / (maxDisplay - minDisplay)) * cw
  const ty = (y: number) => M.top + ch - ((y - yMin) / (yMax - yMin)) * ch

  const curDispX = vars[activeKey] * activeVar.displayScale
  const curYSI   = entry.evaluate(vars)
  const curDispY = Number.isFinite(curYSI) ? curYSI * entry.displayScale : null

  return {
    pts, yMin, yMax, minDisplay, maxDisplay, tx, ty,
    opX: tx(Math.max(minDisplay, Math.min(maxDisplay, curDispX))),
    opY: curDispY != null ? ty(Math.max(yMin, Math.min(yMax, curDispY))) : null,
  }
}
