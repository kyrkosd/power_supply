// Normalized multi-metric line chart for the Parameter Sweep view.
import React, { useCallback, useMemo, useRef } from 'react'
import type { SweepResult } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'
import { METRICS, type ParamDef } from './sweepDefs'
import styles from './SweepView.module.css'

// ── SVG layout constants ──────────────────────────────────────────────────────

const CW = 820, CH = 210
const ML = 38, MR = 14, MT = 14, MB = 34
const PW = CW - ML - MR
const PH = CH - MT - MB

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChartProps {
  result:         SweepResult
  checkedMetrics: Set<string>
  baseSpec:       DesignSpec
  currentParamSI: number
  paramDef:       ParamDef
  hoverIdx:       number | null
  onHover:        (idx: number | null) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * SVG chart rendering all selected metrics normalized to [0, 1] on a shared axis.
 * Each metric has its own min/max and is scaled independently so all curves are visible.
 * Hover fires `onHover` with the closest point index; a vertical rule and dots follow.
 */
export function SweepChart({ result, checkedMetrics, baseSpec, currentParamSI, paramDef, hoverIdx, onHover }: ChartProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  const pts           = result.points
  const activeMetrics = METRICS.filter((m) => checkedMetrics.has(m.key))

  // X values in display units
  const xDisp = pts.map((pt) => pt.paramValue / paramDef.displayScale)
  const xMin  = xDisp[0] ?? 0
  const xMax  = xDisp[xDisp.length - 1] ?? 1
  const xRng  = xMax - xMin || 1

  const xScale        = (v: number) => ML + ((v - xMin) / xRng) * PW
  const currentDispV  = currentParamSI / paramDef.displayScale
  const currentX      = xScale(currentDispV)
  const showCurLine   = currentDispV >= xMin && currentDispV <= xMax

  // Per-metric normalized data (0–1 for chart height)
  const seriesData = useMemo(() =>
    activeMetrics.map((m) => {
      const vals  = pts.map((pt) => { const v = m.get(pt, result.sweepParam, baseSpec); return (v != null && isFinite(v)) ? v : null })
      const valid = vals.filter((v): v is number => v != null)
      const lo    = valid.length ? Math.min(...valid) : 0
      const hi    = valid.length ? Math.max(...valid) : 1
      const rng   = hi - lo || 1
      return { metric: m, vals, norm: vals.map((v) => v != null ? (v - lo) / rng : null) }
    }), [pts, activeMetrics, baseSpec, result.sweepParam])

  // Y scale: norm 0 = bottom, 1 = top
  const yScale = (n: number) => MT + PH - n * PH

  // Splits a normalized series at null gaps → multiple polyline segments
  function buildSegments(norm: (number | null)[], xArr: number[]): string[] {
    const segs: string[] = []
    let cur: string[] = []
    for (let i = 0; i < norm.length; i++) {
      const n = norm[i]
      if (n != null) { cur.push(`${xScale(xArr[i]).toFixed(1)},${yScale(n).toFixed(1)}`) }
      else { if (cur.length >= 2) segs.push(cur.join(' ')); cur = [] }
    }
    if (cur.length >= 2) segs.push(cur.join(' '))
    return segs
  }

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => xMin + t * xRng)
  const fmtTick = (v: number): string => {
    if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(0)}k`
    if (Math.abs(v) >= 100)   return v.toFixed(0)
    if (Math.abs(v) >= 10)    return v.toFixed(1)
    return v.toFixed(2)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = ((e.clientX - rect.left) / rect.width) * CW
    onHover(Math.round(Math.max(0, Math.min(1, (svgX - ML) / PW)) * (pts.length - 1)))
  }, [pts.length, onHover])

  const hX = hoverIdx != null ? xScale(xDisp[hoverIdx]) : null

  return (
    <div className={styles.chartOuter}>
      <svg ref={svgRef} viewBox={`0 0 ${CW} ${CH}`} className={styles.chartSvg} preserveAspectRatio="none">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line key={p} x1={ML} y1={yScale(p)} x2={ML + PW} y2={yScale(p)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + PH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        {/* Y labels */}
        {['100%', '75%', '50%', '25%', '0%'].map((lbl, i) => (
          <text key={lbl} x={ML - 5} y={yScale(1 - i * 0.25) + 4}
            fontSize={9} fill="rgba(148,163,184,0.55)" textAnchor="end">{lbl}</text>
        ))}
        {/* X labels */}
        {xTicks.map((v, i) => (
          <text key={i} x={xScale(v)} y={MT + PH + 13}
            fontSize={9} fill="rgba(148,163,184,0.65)" textAnchor="middle">{fmtTick(v)}</text>
        ))}
        <text x={ML + PW / 2} y={CH - 3} fontSize={9} fill="rgba(148,163,184,0.45)" textAnchor="middle">
          {paramDef.label}{paramDef.unit ? ` (${paramDef.unit})` : ''}
        </text>
        {/* Current operating point */}
        {showCurLine && (
          <>
            <line x1={currentX} y1={MT} x2={currentX} y2={MT + PH}
              stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="5,3" />
            <text x={currentX + 3} y={MT + 10} fontSize={8} fill="rgba(255,255,255,0.4)">current</text>
          </>
        )}
        {/* Series */}
        {seriesData.map(({ metric, norm }) =>
          buildSegments(norm, xDisp).map((p, si) => (
            <polyline key={`${metric.key}-${si}`} points={p} fill="none"
              stroke={metric.color} strokeWidth={1.8} strokeLinejoin="round" opacity={0.9} />
          ))
        )}
        {/* Hover elements */}
        {hX != null && <line x1={hX} y1={MT} x2={hX} y2={MT + PH} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />}
        {hoverIdx != null && seriesData.map(({ metric, norm }) => {
          const n = norm[hoverIdx]
          return n != null ? (
            <circle key={metric.key} cx={hX!} cy={yScale(n)} r={3.5}
              fill={metric.color} stroke="#141624" strokeWidth={1.5} />
          ) : null
        })}
        {/* Mouse hit area */}
        <rect x={ML} y={MT} width={PW} height={PH} fill="transparent"
          onMouseMove={handleMouseMove} onMouseLeave={() => onHover(null)} />
      </svg>
    </div>
  )
}
