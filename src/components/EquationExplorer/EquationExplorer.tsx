import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDesignStore } from '../../store/design-store'
import { findEquation, EQUATIONS, type EquationEntry } from '../../engine/equation-metadata'
import styles from './EquationExplorer.module.css'

// ── Formula text renderer — converts 'V_out' → V<sub>out</sub> ──────────────

function renderFormula(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let buf = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '_' && i + 1 < text.length) {
      if (buf) { parts.push(buf); buf = '' }
      i++
      // collect subscript until space, operator, or end
      let sub = ''
      while (i < text.length && !/[ ×÷()+\-/=,]/.test(text[i])) {
        sub += text[i++]
      }
      parts.push(<sub key={`s${parts.length}`}>{sub}</sub>)
    } else {
      buf += ch
      i++
    }
  }
  if (buf) parts.push(buf)
  return parts
}

// ── SVG plot ─────────────────────────────────────────────────────────────────

interface PlotProps {
  entry: EquationEntry
  vars: Record<string, number>   // SI values
  activeKey: string
}

function Plot({ entry, vars, activeKey }: PlotProps): React.ReactElement {
  const activeVar = entry.variables.find((v) => v.key === activeKey)
  if (!activeVar) return <div className={styles.plotWrapper} />

  const SVG_W = 372
  const SVG_H = 140
  const M = { top: 12, right: 12, bottom: 28, left: 52 }
  const cw = SVG_W - M.left - M.right
  const ch = SVG_H - M.top - M.bottom

  const minDisplay = activeVar.min
  const maxDisplay = activeVar.max
  const minSI = minDisplay / activeVar.displayScale
  const maxSI = maxDisplay / activeVar.displayScale

  const N = 60
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < N; i++) {
    const xSI = minSI + (maxSI - minSI) * (i / (N - 1))
    const testVars = { ...vars, [activeKey]: xSI }
    const ySI = entry.evaluate(testVars)
    if (Number.isFinite(ySI) && ySI >= 0) {
      pts.push({ x: xSI * activeVar.displayScale, y: ySI * entry.displayScale })
    }
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

  const yVals = pts.map((p) => p.y)
  const rawYMin = Math.min(...yVals)
  const rawYMax = Math.max(...yVals)
  const yPad = (rawYMax - rawYMin) * 0.08 || rawYMax * 0.1 || 0.01
  const yMin = Math.max(0, rawYMin - yPad)
  const yMax = rawYMax + yPad

  const tx = (x: number) => M.left + ((x - minDisplay) / (maxDisplay - minDisplay)) * cw
  const ty = (y: number) => M.top + ch - ((y - yMin) / (yMax - yMin)) * ch

  const polyline = pts.map((p) => `${tx(p.x).toFixed(1)},${ty(p.y).toFixed(1)}`).join(' ')

  // operating point
  const currentDisplayX = vars[activeKey] * activeVar.displayScale
  const currentYSI = entry.evaluate(vars)
  const currentDisplayY = Number.isFinite(currentYSI) ? currentYSI * entry.displayScale : null
  const opX = tx(Math.max(minDisplay, Math.min(maxDisplay, currentDisplayX)))
  const opY = currentDisplayY != null ? ty(Math.max(yMin, Math.min(yMax, currentDisplayY))) : null

  const fmtAxis = (v: number): string => {
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}k`
    if (Math.abs(v) >= 1) return v.toFixed(1)
    return v.toFixed(3)
  }

  return (
    <div className={styles.plotWrapper}>
      <svg className={styles.plotSvg} viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
        {/* Axes */}
        <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + ch} stroke="#334155" strokeWidth="1" />
        <line x1={M.left} y1={M.top + ch} x2={M.left + cw} y2={M.top + ch} stroke="#334155" strokeWidth="1" />

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f}
            x1={M.left} y1={M.top + ch * f}
            x2={M.left + cw} y2={M.top + ch * f}
            stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3"
          />
        ))}

        {/* Curve */}
        <polyline points={polyline} fill="none" stroke="#32c9e6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Operating point */}
        {opY != null && (
          <>
            <line x1={opX} y1={M.top} x2={opX} y2={M.top + ch} stroke="#00f2ff" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
            <circle cx={opX} cy={opY} r="5" fill="#00f2ff" stroke="#141624" strokeWidth="1.5" />
          </>
        )}

        {/* Y axis labels */}
        <text x={M.left - 4} y={M.top + 4} textAnchor="end" fill="#64748b" fontSize="9">{fmtAxis(yMax)} {entry.displayUnit}</text>
        <text x={M.left - 4} y={M.top + ch + 4} textAnchor="end" fill="#64748b" fontSize="9">{fmtAxis(yMin)}</text>

        {/* X axis labels */}
        <text x={M.left} y={SVG_H - 4} textAnchor="start" fill="#64748b" fontSize="9">{fmtAxis(minDisplay)} {activeVar.displayUnit}</text>
        <text x={M.left + cw} y={SVG_H - 4} textAnchor="end" fill="#64748b" fontSize="9">{fmtAxis(maxDisplay)}</text>
      </svg>
    </div>
  )
}

// ── Sensitivity computation ───────────────────────────────────────────────────

interface SensitivityResult {
  key: string
  symbol: string
  elasticity: number    // ∂y/∂x × x/y
  description: string
}

function computeSensitivities(entry: EquationEntry, vars: Record<string, number>): SensitivityResult[] {
  const y0 = entry.evaluate(vars)
  if (!Number.isFinite(y0) || Math.abs(y0) < 1e-30) return []

  return entry.variables.map((v) => {
    const eps = 0.001
    const x0 = vars[v.key]
    if (!Number.isFinite(x0) || Math.abs(x0) < 1e-30) {
      return { key: v.key, symbol: v.symbol, elasticity: 0, description: 'constant' }
    }
    const yPlus  = entry.evaluate({ ...vars, [v.key]: x0 * (1 + eps) })
    const yMinus = entry.evaluate({ ...vars, [v.key]: x0 * (1 - eps) })
    const deriv  = (yPlus - yMinus) / (2 * eps * x0)
    const elasticity = deriv * (x0 / y0)

    let description = 'insensitive'
    const e = Math.abs(elasticity)
    if (e > 0.9 && e < 1.1) {
      description = elasticity > 0 ? 'directly proportional' : 'inversely proportional'
    } else if (e > 1.8 && e < 2.2) {
      description = elasticity > 0 ? 'quadratic' : 'inverse square'
    } else if (e > 0.4 && e < 0.6) {
      description = 'square-root relationship'
    } else if (e < 0.1) {
      description = 'insensitive'
    } else {
      description = elasticity > 0 ? `increases ×${e.toFixed(1)} for each ×2 increase` : `decreases ×${e.toFixed(1)} for each ×2 increase`
    }

    return { key: v.key, symbol: v.symbol, elasticity, description }
  }).sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity))
}

// ── Main component ────────────────────────────────────────────────────────────

export function EquationExplorer(): React.ReactElement | null {
  const activeEquationId  = useDesignStore((s) => s.activeEquationId)
  const setActiveEquation = useDesignStore((s) => s.setActiveEquationId)
  const spec   = useDesignStore((s) => s.spec)
  const result = useDesignStore((s) => s.result)

  const entry = useMemo(() => activeEquationId ? findEquation(activeEquationId) : null, [activeEquationId])

  // Local slider state — initialise from current spec/result when entry changes
  const [sliderVals, setSliderVals] = useState<Record<string, number>>({})
  const [activeVarKey, setActiveVarKey] = useState<string>('')

  useEffect(() => {
    if (!entry) return
    const initial: Record<string, number> = {}
    for (const v of entry.variables) {
      initial[v.key] = v.extract(spec, result)
    }
    setSliderVals(initial)
    setActiveVarKey(entry.variables[0]?.key ?? '')
  }, [entry?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSliderChange = useCallback((key: string, displayValue: number, displayScale: number) => {
    setActiveVarKey(key)
    setSliderVals((prev) => ({ ...prev, [key]: displayValue / displayScale }))
  }, [])

  const close = useCallback(() => setActiveEquation(null), [setActiveEquation])

  // Escape key
  useEffect(() => {
    if (!activeEquationId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeEquationId, close])

  const isOpen = !!entry

  // Computed result from sliders
  const liveResult = useMemo(() => {
    if (!entry || Object.keys(sliderVals).length === 0) return null
    const r = entry.evaluate(sliderVals)
    return Number.isFinite(r) ? r : null
  }, [entry, sliderVals])

  const sensitivities = useMemo(() => {
    if (!entry || Object.keys(sliderVals).length === 0) return []
    return computeSensitivities(entry, sliderVals)
  }, [entry, sliderVals])

  const panel = (
    <>
      {isOpen && <div className={styles.backdrop} onClick={close} />}
      <div className={`${styles.panel} ${isOpen ? styles.open : ''}`} role="dialog" aria-modal="true">
        {entry && (
          <>
            <div className={styles.header}>
              <span className={styles.headerSymbol}>{entry.symbol}</span>
              <span className={styles.headerLabel}>{entry.label}</span>
              <button className={styles.headerClose} onClick={close} aria-label="Close equation explorer">✕</button>
            </div>

            <div className={styles.body}>
              {/* ── Formula ── */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Formula</div>
                <div className={styles.formulaBlock}>
                  <div className={styles.formulaLine}>{renderFormula(entry.formula)}</div>
                  {liveResult != null && (
                    <>
                      <div className={styles.formulaSub} />
                      <div className={styles.substitutedLine}>
                        {entry.substituted(sliderVals, liveResult)}
                      </div>
                    </>
                  )}
                </div>
                {liveResult != null && (
                  <div className={styles.resultHighlight}>
                    {entry.symbol} = {(liveResult * entry.displayScale).toFixed(
                      entry.displayUnit === '%' ? 2 : entry.displayUnit === 'W' ? 4 : 3
                    )} {entry.displayUnit}
                  </div>
                )}
              </div>

              {/* ── Variable sliders ── */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Explore Variables (local — does not change design)</div>
                <div className={styles.variablesGrid}>
                  {entry.variables.map((v) => {
                    const siVal = sliderVals[v.key] ?? v.extract(spec, result)
                    const displayVal = siVal * v.displayScale
                    const isActive = v.key === activeVarKey
                    return (
                      <div key={v.key} className={styles.varRow}>
                        <label className={styles.varLabel} htmlFor={`slider-${v.key}`}>
                          {renderFormula(v.symbol)}
                        </label>
                        <input
                          id={`slider-${v.key}`}
                          type="range"
                          className={`${styles.varSlider} ${isActive ? styles.active : ''}`}
                          min={v.min}
                          max={v.max}
                          step={v.step}
                          value={displayVal}
                          onChange={(e) => handleSliderChange(v.key, Number(e.target.value), v.displayScale)}
                          onMouseDown={() => setActiveVarKey(v.key)}
                          onTouchStart={() => setActiveVarKey(v.key)}
                        />
                        <span className={`${styles.varValue} ${isActive ? styles.active : ''}`}>
                          {displayVal < 10 ? displayVal.toFixed(2) : displayVal.toFixed(displayVal >= 1000 ? 0 : 1)} {v.displayUnit}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {liveResult != null && (
                  <div className={styles.liveResult}>
                    → <span>{entry.symbol} = {(liveResult * entry.displayScale).toFixed(entry.displayUnit === 'W' ? 4 : 3)} {entry.displayUnit}</span>
                  </div>
                )}
              </div>

              {/* ── Live plot ── */}
              {entry.variables.length > 0 && Object.keys(sliderVals).length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>
                    {entry.symbol} vs {renderFormula(entry.variables.find((v) => v.key === activeVarKey)?.symbol ?? activeVarKey)}
                  </div>
                  <Plot entry={entry} vars={sliderVals} activeKey={activeVarKey} />
                  <div className={styles.plotTitle}>
                    drag a slider above to change the plotted variable
                  </div>
                </div>
              )}

              {/* ── Sensitivity ── */}
              {sensitivities.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Sensitivity (elasticity)</div>
                  <div className={styles.sensitivityList}>
                    {sensitivities.slice(0, 4).map((s) => {
                      const barWidth = Math.min(80, Math.round(Math.abs(s.elasticity) * 50))
                      const isPos = s.elasticity >= 0
                      const dir = isPos ? '↑' : '↓'
                      const sign = isPos ? '+' : '−'
                      return (
                        <div key={s.key} className={styles.sensitivityRow}>
                          <div
                            className={`${styles.sensitivityBar} ${isPos ? styles.positive : styles.negative}`}
                            style={{ width: `${barWidth}px` }}
                          />
                          <span className={styles.sensitivityText}>
                            {dir}&thinsp;<strong>{renderFormula(s.symbol)}</strong>&thinsp;±10 % → {entry.symbol}&thinsp;{sign}{(Math.abs(s.elasticity) * 10).toFixed(1)} % <em>({s.description})</em>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Learn more ── */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Engineering Significance</div>
                <div className={styles.learnMore}>
                  {entry.description}
                  <div className={styles.sourceRef}>📖 {entry.source_ref}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )

  return createPortal(panel, document.body)
}

// ── Equation button — rendered next to any clickable result value ─────────────

interface EquationButtonProps {
  equationId: string
  children?: React.ReactNode
}

export function EquationButton({ equationId, children }: EquationButtonProps): React.ReactElement | null {
  const setActive = useDesignStore((s) => s.setActiveEquationId)
  const eq = findEquation(equationId)
  if (!eq) return null

  return (
    <button
      title={`Explore: ${eq.label}`}
      onClick={() => setActive(equationId)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'rgba(50, 201, 230, 0.7)',
        fontSize: '11px',
        padding: '0 3px',
        verticalAlign: 'middle',
        lineHeight: 1,
      }}
      aria-label={`Open equation explorer for ${eq.label}`}
    >
      {children ?? 'ƒ'}
    </button>
  )
}

export { EQUATIONS }
