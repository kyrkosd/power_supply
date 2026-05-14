// Formula rendering, SVG sensitivity plot, and elasticity analysis for EquationExplorer.
import React from 'react'
import type { EquationEntry } from '../../engine/equation-metadata'
import styles from './EquationExplorer.module.css'
import { SVG_W, SVG_H, M, CW, CH, fmtAxis, computePlotGeometry } from './analysis/plotMath'

export type { SensitivityResult } from './analysis/sensitivity'
export { computeSensitivities } from './analysis/sensitivity'

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

export interface PlotProps {
  entry:     EquationEntry
  vars:      Record<string, number>
  activeKey: string
}

export function Plot({ entry, vars, activeKey }: PlotProps): React.ReactElement {
  const activeVar = entry.variables.find((v) => v.key === activeKey)
  if (!activeVar) return <div className={styles.plotWrapper} />

  const geo = computePlotGeometry(entry, vars, activeKey)
  if (!geo) {
    return (
      <div className={styles.plotWrapper}>
        <svg className={styles.plotSvg} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
          <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" fill="#64748b" fontSize="11">No data</text>
        </svg>
      </div>
    )
  }

  const { pts, yMin, yMax, minDisplay, maxDisplay, tx, ty, opX, opY } = geo
  const polyline = pts.map((p) => `${tx(p.x).toFixed(1)},${ty(p.y).toFixed(1)}`).join(' ')

  return (
    <div className={styles.plotWrapper}>
      <svg className={styles.plotSvg} viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
        <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + CH} stroke="#334155" strokeWidth="1" />
        <line x1={M.left} y1={M.top + CH} x2={M.left + CW} y2={M.top + CH} stroke="#334155" strokeWidth="1" />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={M.left} y1={M.top + CH * f} x2={M.left + CW} y2={M.top + CH * f}
            stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <polyline points={polyline} fill="none" stroke="#32c9e6" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {opY != null && (
          <>
            <line x1={opX} y1={M.top} x2={opX} y2={M.top + CH}
              stroke="#00f2ff" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
            <circle cx={opX} cy={opY} r="5" fill="#00f2ff" stroke="#141624" strokeWidth="1.5" />
          </>
        )}
        <text x={M.left - 4} y={M.top + 4} textAnchor="end" fill="#64748b" fontSize="9">
          {fmtAxis(yMax)} {entry.displayUnit}
        </text>
        <text x={M.left - 4} y={M.top + CH + 4} textAnchor="end" fill="#64748b" fontSize="9">
          {fmtAxis(yMin)}
        </text>
        <text x={M.left} y={SVG_H - 4} textAnchor="start" fill="#64748b" fontSize="9">
          {fmtAxis(minDisplay)} {activeVar.displayUnit}
        </text>
        <text x={M.left + CW} y={SVG_H - 4} textAnchor="end" fill="#64748b" fontSize="9">
          {fmtAxis(maxDisplay)}
        </text>
      </svg>
    </div>
  )
}
