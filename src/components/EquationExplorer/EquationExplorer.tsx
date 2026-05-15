// Interactive equation explorer: formula display, variable sliders, SVG plot, sensitivity analysis.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDesignStore } from '../../store/design-store'
import { findEquation, EQUATIONS } from '../../engine/equation-metadata'
import type { EquationEntry } from '../../engine/equation-metadata'
import { renderFormula, Plot, computeSensitivities } from './equationAnalysis'
import styles from './EquationExplorer.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function resultPrecision(unit: string): number {
  if (unit === '%') return 2
  if (unit === 'W') return 4
  return 3
}

function formatDisplayVal(val: number): string {
  return val < 10 ? val.toFixed(2) : val.toFixed(val >= 1000 ? 0 : 1)
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface VarRowProps {
  v: { key: string; symbol: string; displayScale: number; min: number; max: number; step: number; displayUnit: string }
  sliderVal: number
  isActive: boolean
  onSlide: (key: string, val: number, scale: number) => void
  onActivate: (key: string) => void
}

function VariableRow({ v, sliderVal, isActive, onSlide, onActivate }: VarRowProps): React.ReactElement {
  const displayVal = sliderVal * v.displayScale
  return (
    <div className={styles.varRow}>
      <label className={styles.varLabel} htmlFor={`slider-${v.key}`}>
        {renderFormula(v.symbol)}
      </label>
      <input id={`slider-${v.key}`} type="range"
        className={`${styles.varSlider} ${isActive ? styles.active : ''}`}
        min={v.min} max={v.max} step={v.step} value={displayVal}
        onChange={(e) => onSlide(v.key, Number(e.target.value), v.displayScale)}
        onMouseDown={() => onActivate(v.key)}
        onTouchStart={() => onActivate(v.key)} />
      <span className={`${styles.varValue} ${isActive ? styles.active : ''}`}>
        {formatDisplayVal(displayVal)} {v.displayUnit}
      </span>
    </div>
  )
}

interface SensRowProps {
  s: { key: string; elasticity: number; symbol: string; description: string }
  resultSymbol: string
}

function SensitivityRow({ s, resultSymbol }: SensRowProps): React.ReactElement {
  const barWidth = Math.min(80, Math.round(Math.abs(s.elasticity) * 50))
  const isPos    = s.elasticity >= 0
  return (
    <div className={styles.sensitivityRow}>
      <div className={`${styles.sensitivityBar} ${isPos ? styles.positive : styles.negative}`}
        style={{ width: `${barWidth}px` }} />
      <span className={styles.sensitivityText}>
        {isPos ? '↑' : '↓'}&thinsp;<strong>{renderFormula(s.symbol)}</strong>&thinsp;
        ±10 % → {resultSymbol}&thinsp;{isPos ? '+' : '−'}
        {(Math.abs(s.elasticity) * 10).toFixed(1)} % <em>({s.description})</em>
      </span>
    </div>
  )
}

// ── Panel body ────────────────────────────────────────────────────────────────

type SensRow = ReturnType<typeof computeSensitivities>[number]

interface PanelBodyProps {
  entry: EquationEntry
  sliderVals: Record<string, number>
  liveResult: number | null
  sensitivities: SensRow[]
  activeVarKey: string
  spec: ReturnType<typeof useDesignStore.getState>['spec']
  result: ReturnType<typeof useDesignStore.getState>['result']
  onSlide: (key: string, val: number, scale: number) => void
  onActivate: (key: string) => void
}

/** Panel content rendered when an equation is active — formula, sliders, plot, sensitivities. */
function EquationPanelBody({ entry, sliderVals, liveResult, sensitivities, activeVarKey, spec, result, onSlide, onActivate }: PanelBodyProps): React.ReactElement {
  return (
    <>
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
            {entry.symbol} = {(liveResult * entry.displayScale).toFixed(resultPrecision(entry.displayUnit))} {entry.displayUnit}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Explore Variables (local — does not change design)</div>
        <div className={styles.variablesGrid}>
          {entry.variables.map((v) => (
            <VariableRow key={v.key} v={v}
              sliderVal={sliderVals[v.key] ?? v.extract(spec, result)}
              isActive={v.key === activeVarKey}
              onSlide={onSlide}
              onActivate={onActivate} />
          ))}
        </div>
        {liveResult != null && (
          <div className={styles.liveResult}>
            → <span>{entry.symbol} = {(liveResult * entry.displayScale).toFixed(resultPrecision(entry.displayUnit))} {entry.displayUnit}</span>
          </div>
        )}
      </div>

      {entry.variables.length > 0 && Object.keys(sliderVals).length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {entry.symbol} vs {renderFormula(entry.variables.find((v) => v.key === activeVarKey)?.symbol ?? activeVarKey)}
          </div>
          <Plot entry={entry} vars={sliderVals} activeKey={activeVarKey} />
          <div className={styles.plotTitle}>drag a slider above to change the plotted variable</div>
        </div>
      )}

      {sensitivities.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Sensitivity (elasticity)</div>
          <div className={styles.sensitivityList}>
            {sensitivities.slice(0, 4).map((s) => (
              <SensitivityRow key={s.key} s={s} resultSymbol={entry.symbol} />
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Engineering Significance</div>
        <div className={styles.learnMore}>
          {entry.description}
          <div className={styles.sourceRef}>📖 {entry.source_ref}</div>
        </div>
      </div>
    </>
  )
}

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
              <EquationPanelBody entry={entry} sliderVals={sliderVals} liveResult={liveResult}
                sensitivities={sensitivities} activeVarKey={activeVarKey}
                spec={spec} result={result}
                onSlide={handleSliderChange} onActivate={setActiveVarKey} />
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
