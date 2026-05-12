// Formula rendering, SVG sensitivity plot, and elasticity analysis for EquationExplorer.
import React from 'react'
import type { EquationEntry } from '../../engine/equation-metadata'
import styles from './EquationExplorer.module.css'

// ── Formula text renderer ─────────────────────────────────────────────────────

/**
 * Converts plain-text formula strings into React nodes with HTML subscripts.
 * Underscore notation: `V_out` → `V<sub>out</sub>`.
 * Subscript ends at the next whitespace or operator character.
 */
export function renderFormula(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let buf = '', i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '_' && i + 1 < text.length) {
      if (buf) { parts.push(buf); buf = '' }
      i++
      let sub = ''
      while (i < text.length && !/[ ×÷()+\-/=,]/.test(text[i])) sub += text[i++]
      parts.push(<sub key={`s${parts.length}`}>{sub}</sub>)
    } else { buf += ch; i++ }
  }
  if (buf) parts.push(buf)
  return parts
}

// ── SVG sensitivity plot ──────────────────────────────────────────────────────

export interface PlotProps {
  entry:     EquationEntry
  vars:      Record<string, number>   // SI values
  activeKey: string
}

/**
 * Renders a 60-point SVG curve of the equation output vs the active variable.
 * Shows the current operating point as a highlighted dot with a dashed crosshair.
 */
export function Plot({ entry, vars, activeKey }: PlotProps): React.ReactElement {
  const activeVar = entry.variables.find((v) => v.key === activeKey)
  if (!activeVar) return <div className={styles.plotWrapper} />

  const SVG_W = 372, SVG_H = 140
  const M = { top: 12, right: 12, bottom: 28, left: 52 }
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

  if (pts.length < 2) {
    return (
      <div className={styles.plotWrapper}>
        <svg className={styles.plotSvg} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
          <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" fill="#64748b" fontSize="11">No data</text>
        </svg>
      </div>
    )
  }

  const yVals  = pts.map((p) => p.y)
  const rawMin = Math.min(...yVals), rawMax = Math.max(...yVals)
  const yPad   = (rawMax - rawMin) * 0.08 || rawMax * 0.1 || 0.01
  const yMin   = Math.max(0, rawMin - yPad), yMax = rawMax + yPad

  const tx = (x: number) => M.left + ((x - minDisplay) / (maxDisplay - minDisplay)) * cw
  const ty = (y: number) => M.top + ch - ((y - yMin) / (yMax - yMin)) * ch

  const polyline = pts.map((p) => `${tx(p.x).toFixed(1)},${ty(p.y).toFixed(1)}`).join(' ')

  const curDispX   = vars[activeKey] * activeVar.displayScale
  const curYSI     = entry.evaluate(vars)
  const curDispY   = Number.isFinite(curYSI) ? curYSI * entry.displayScale : null
  const opX        = tx(Math.max(minDisplay, Math.min(maxDisplay, curDispX)))
  const opY        = curDispY != null ? ty(Math.max(yMin, Math.min(yMax, curDispY))) : null

  const fmtAxis = (v: number): string => {
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}k`
    if (Math.abs(v) >= 1)   return v.toFixed(1)
    return v.toFixed(3)
  }

  return (
    <div className={styles.plotWrapper}>
      <svg className={styles.plotSvg} viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
        <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + ch} stroke="#334155" strokeWidth="1" />
        <line x1={M.left} y1={M.top + ch} x2={M.left + cw} y2={M.top + ch} stroke="#334155" strokeWidth="1" />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={M.left} y1={M.top + ch * f} x2={M.left + cw} y2={M.top + ch * f}
            stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <polyline points={polyline} fill="none" stroke="#32c9e6" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {opY != null && (
          <>
            <line x1={opX} y1={M.top} x2={opX} y2={M.top + ch}
              stroke="#00f2ff" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
            <circle cx={opX} cy={opY} r="5" fill="#00f2ff" stroke="#141624" strokeWidth="1.5" />
          </>
        )}
        <text x={M.left - 4} y={M.top + 4} textAnchor="end" fill="#64748b" fontSize="9">
          {fmtAxis(yMax)} {entry.displayUnit}
        </text>
        <text x={M.left - 4} y={M.top + ch + 4} textAnchor="end" fill="#64748b" fontSize="9">
          {fmtAxis(yMin)}
        </text>
        <text x={M.left} y={SVG_H - 4} textAnchor="start" fill="#64748b" fontSize="9">
          {fmtAxis(minDisplay)} {activeVar.displayUnit}
        </text>
        <text x={M.left + cw} y={SVG_H - 4} textAnchor="end" fill="#64748b" fontSize="9">
          {fmtAxis(maxDisplay)}
        </text>
      </svg>
    </div>
  )
}

// ── Sensitivity analysis ──────────────────────────────────────────────────────

export interface SensitivityResult {
  key:         string
  symbol:      string
  elasticity:  number      // ∂y/∂x × x/y — dimensionless elasticity
  description: string
}

/**
 * Computes the elasticity of the equation output w.r.t. each variable using
 * central finite differences with ±0.1 % perturbation.
 * Results are sorted by |elasticity| descending (most influential first).
 */
export function computeSensitivities(entry: EquationEntry, vars: Record<string, number>): SensitivityResult[] {
  const y0 = entry.evaluate(vars)
  if (!Number.isFinite(y0) || Math.abs(y0) < 1e-30) return []

  return entry.variables.map((v) => {
    const eps = 0.001, x0 = vars[v.key]
    if (!Number.isFinite(x0) || Math.abs(x0) < 1e-30)
      return { key: v.key, symbol: v.symbol, elasticity: 0, description: 'constant' }

    const yPlus  = entry.evaluate({ ...vars, [v.key]: x0 * (1 + eps) })
    const yMinus = entry.evaluate({ ...vars, [v.key]: x0 * (1 - eps) })
    const elasticity = ((yPlus - yMinus) / (2 * eps * x0)) * (x0 / y0)

    const e = Math.abs(elasticity)
    let description: string
    if (e < 0.1)                description = 'insensitive'
    else if (e > 0.9 && e < 1.1) description = elasticity > 0 ? 'directly proportional' : 'inversely proportional'
    else if (e > 1.8 && e < 2.2) description = elasticity > 0 ? 'quadratic' : 'inverse square'
    else if (e > 0.4 && e < 0.6) description = 'square-root relationship'
    else description = elasticity > 0 ? `increases ×${e.toFixed(1)} for each ×2 increase` : `decreases ×${e.toFixed(1)} for each ×2 increase`

    return { key: v.key, symbol: v.symbol, elasticity, description }
  }).sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity))
}
