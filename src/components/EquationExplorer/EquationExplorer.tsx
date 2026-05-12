// Interactive equation explorer: formula display, variable sliders, SVG plot, sensitivity analysis.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDesignStore } from '../../store/design-store'
import { findEquation, EQUATIONS } from '../../engine/equation-metadata'
import { renderFormula, Plot, computeSensitivities } from './equationAnalysis'
import styles from './EquationExplorer.module.css'

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Slide-in side panel rendered into a portal on document.body.
 * Opens when any result value's equation button is clicked (setActiveEquationId).
 * Shows formula (with live substitution), variable sliders, a sensitivity plot,
 * and an elasticity table. All edits are local — the live design is never changed.
 */
export function EquationExplorer(): React.ReactElement | null {
  const activeEquationId  = useDesignStore((s) => s.activeEquationId)
  const setActiveEquation = useDesignStore((s) => s.setActiveEquationId)
  const spec              = useDesignStore((s) => s.spec)
  const result            = useDesignStore((s) => s.result)

  const entry = useMemo(() => activeEquationId ? findEquation(activeEquationId) : null, [activeEquationId])

  const [sliderVals,   setSliderVals]   = useState<Record<string, number>>({})
  const [activeVarKey, setActiveVarKey] = useState<string>('')

  // Re-initialise sliders from current spec/result whenever the active equation changes
  useEffect(() => {
    if (!entry) return
    const initial: Record<string, number> = {}
    for (const v of entry.variables) initial[v.key] = v.extract(spec, result)
    setSliderVals(initial)
    setActiveVarKey(entry.variables[0]?.key ?? '')
  }, [entry?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSliderChange = useCallback((key: string, displayValue: number, displayScale: number) => {
    setActiveVarKey(key)
    setSliderVals((prev) => ({ ...prev, [key]: displayValue / displayScale }))
  }, [])

  const close = useCallback(() => setActiveEquation(null), [setActiveEquation])

  useEffect(() => {
    if (!activeEquationId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeEquationId, close])

  const liveResult = useMemo(() => {
    if (!entry || Object.keys(sliderVals).length === 0) return null
    const r = entry.evaluate(sliderVals)
    return Number.isFinite(r) ? r : null
  }, [entry, sliderVals])

  const sensitivities = useMemo(() => {
    if (!entry || Object.keys(sliderVals).length === 0) return []
    return computeSensitivities(entry, sliderVals)
  }, [entry, sliderVals])

  const isOpen = !!entry

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
              {/* Formula + live substitution */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Formula</div>
                <div className={styles.formulaBlock}>
                  <div className={styles.formulaLine}>{renderFormula(entry.formula)}</div>
                  {liveResult != null && (
                    <><div className={styles.formulaSub} />
                    <div className={styles.substitutedLine}>{entry.substituted(sliderVals, liveResult)}</div></>
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

              {/* Variable sliders */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Explore Variables (local — does not change design)</div>
                <div className={styles.variablesGrid}>
                  {entry.variables.map((v) => {
                    const siVal     = sliderVals[v.key] ?? v.extract(spec, result)
                    const displayVal = siVal * v.displayScale
                    const isActive   = v.key === activeVarKey
                    return (
                      <div key={v.key} className={styles.varRow}>
                        <label className={styles.varLabel} htmlFor={`slider-${v.key}`}>
                          {renderFormula(v.symbol)}
                        </label>
                        <input id={`slider-${v.key}`} type="range"
                          className={`${styles.varSlider} ${isActive ? styles.active : ''}`}
                          min={v.min} max={v.max} step={v.step} value={displayVal}
                          onChange={(e) => handleSliderChange(v.key, Number(e.target.value), v.displayScale)}
                          onMouseDown={() => setActiveVarKey(v.key)}
                          onTouchStart={() => setActiveVarKey(v.key)} />
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

              {/* Live SVG plot */}
              {entry.variables.length > 0 && Object.keys(sliderVals).length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>
                    {entry.symbol} vs {renderFormula(entry.variables.find((v) => v.key === activeVarKey)?.symbol ?? activeVarKey)}
                  </div>
                  <Plot entry={entry} vars={sliderVals} activeKey={activeVarKey} />
                  <div className={styles.plotTitle}>drag a slider above to change the plotted variable</div>
                </div>
              )}

              {/* Sensitivity / elasticity */}
              {sensitivities.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Sensitivity (elasticity)</div>
                  <div className={styles.sensitivityList}>
                    {sensitivities.slice(0, 4).map((s) => {
                      const barWidth = Math.min(80, Math.round(Math.abs(s.elasticity) * 50))
                      const isPos    = s.elasticity >= 0
                      return (
                        <div key={s.key} className={styles.sensitivityRow}>
                          <div className={`${styles.sensitivityBar} ${isPos ? styles.positive : styles.negative}`}
                            style={{ width: `${barWidth}px` }} />
                          <span className={styles.sensitivityText}>
                            {isPos ? '↑' : '↓'}&thinsp;<strong>{renderFormula(s.symbol)}</strong>&thinsp;
                            ±10 % → {entry.symbol}&thinsp;{isPos ? '+' : '−'}
                            {(Math.abs(s.elasticity) * 10).toFixed(1)} % <em>({s.description})</em>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Engineering significance */}
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

// ── Equation button ───────────────────────────────────────────────────────────

interface EquationButtonProps { equationId: string; children?: React.ReactNode }

/**
 * Small inline button that opens the equation explorer for the given equation ID.
 * Returns null if the equation ID is not found in the catalog.
 */
export function EquationButton({ equationId, children }: EquationButtonProps): React.ReactElement | null {
  const setActive = useDesignStore((s) => s.setActiveEquationId)
  const eq = findEquation(equationId)
  if (!eq) return null

  return (
    <button title={`Explore: ${eq.label}`} onClick={() => setActive(equationId)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(50,201,230,0.7)',
        fontSize: '11px', padding: '0 3px', verticalAlign: 'middle', lineHeight: 1 }}
      aria-label={`Open equation explorer for ${eq.label}`}>
      {children ?? 'ƒ'}
    </button>
  )
}

export { EQUATIONS }
