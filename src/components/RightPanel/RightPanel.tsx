// Right panel: key result cards, error/warning alerts, component suggestions, and design notes.
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import type { DesignResult } from '../../engine/types'
import { validateSpec } from '../../engine/validation'
import { ComponentSuggestions } from '../ComponentSuggestions/ComponentSuggestions'
import styles from './RightPanel.module.css'

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Format duty cycle (0–1) as a percentage string. */
function fmtDuty(d: number): string  { return `${(d * 100).toFixed(1)}%` }
/** Format efficiency (0–1) as a percentage string. */
function fmtEta(e: number): string   { return `${(e * 100).toFixed(1)}%` }

/** Format a Henry value with mH / µH / nH auto-scaling. */
function fmtInductance(h: number): string {
  if (h >= 1e-3) return `${(h * 1e3).toFixed(2)} mH`
  if (h >= 1e-6) return `${(h * 1e6).toFixed(2)} µH`
  return `${(h * 1e9).toFixed(1)} nH`
}

/** Format a Farad value with mF / µF / nF auto-scaling. */
function fmtCapacitance(f: number): string {
  if (f >= 1e-3) return `${(f * 1e3).toFixed(2)} mF`
  if (f >= 1e-6) return `${(f * 1e6).toFixed(1)} µF`
  return `${(f * 1e9).toFixed(0)} nF`
}

/** Format a Watt value as mW (< 1 W) or W. */
function fmtLoss(w: number): string { return w < 1 ? `${(w * 1000).toFixed(0)} mW` : `${w.toFixed(2)} W` }

// ── Sub-components ────────────────────────────────────────────────────────────

/** Returns formatted value when result is present, otherwise '—'. */
function rv(result: DesignResult | null, fmt: (r: DesignResult) => string): string {
  return result != null ? fmt(result) : '—'
}

/** Single metric card in the result grid. */
function ResultCard({ label, value, sub, accent, warn }: {
  label: string; value: string; sub?: string; accent?: boolean; warn?: boolean
}): React.ReactElement {
  return (
    <div className={styles.card}>
      <span className={styles.cardLabel}>{label}</span>
      <span className={`${styles.cardValue} ${accent ? styles.accentVal : ''} ${warn ? styles.warnVal : ''}`}>
        {value}
      </span>
      {sub && <span className={styles.cardSub}>{sub}</span>}
    </div>
  )
}

/** Errors and warnings alert area; renders nothing when both lists are empty. */
function AlertsArea({ errMsgs, warnings }: { errMsgs: string[]; warnings: string[] }): React.ReactElement | null {
  if (errMsgs.length === 0 && warnings.length === 0) return null
  return (
    <div className={styles.alertsArea}>
      {errMsgs.map((msg, i) => (
        <div key={i} className={styles.alertError}>
          <span className={styles.alertIcon}>✕</span>{msg}
        </div>
      ))}
      {warnings.length > 0 && (
        <details className={styles.warningsGroup} open>
          <summary className={styles.warningsSummary}>
            ⚠ {warnings.length} warning{warnings.length > 1 ? 's' : ''}
          </summary>
          <ul className={styles.warningList}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/** Right panel: key result cards, validation alerts, component suggestions, and notes. */
export function RightPanel(): React.ReactElement {
  const { result, topology, spec, notes, setNotes } = useDesignStore()
  const { errors } = validateSpec(topology, spec)

  const warnings = [
    ...errors.filter((e) => e.severity === 'warning').map((e) => e.message),
    ...(result?.warnings ?? []),
  ]
  const errMsgs  = errors.filter((e) => e.severity === 'error').map((e) => e.message)
  const etaWarn  = result?.efficiency != null && result.efficiency < 0.8
  const totalLoss = result?.losses?.total

  return (
    <div className={styles.panel}>
      {/* Key result cards */}
      <div className={styles.cardsGrid}>
        <ResultCard label="Duty Cycle"   value={rv(result, (r) => fmtDuty(r.dutyCycle))} sub={result?.operating_mode} />
        <ResultCard label="Efficiency"   value={result?.efficiency != null ? fmtEta(result.efficiency) : '—'} accent={!etaWarn && result?.efficiency != null} warn={etaWarn} />
        <ResultCard label="Inductance"   value={rv(result, (r) => fmtInductance(r.inductance))} />
        <ResultCard label="Capacitance"  value={rv(result, (r) => fmtCapacitance(r.capacitance))} />
        <ResultCard label="Peak Current" value={rv(result, (r) => `${r.peakCurrent.toFixed(2)} A`)} />
        {totalLoss != null && <ResultCard label="Total Loss" value={fmtLoss(totalLoss)} />}
      </div>

      {/* Errors / Warnings */}
      <AlertsArea errMsgs={errMsgs} warnings={warnings} />

      {/* Scrollable body: component suggestions + notes */}
      <div className={styles.scrollBody}>
        <ComponentSuggestions />
        <details className={styles.notesSection}>
          <summary className={styles.notesTitle}>Notes</summary>
          <textarea
            className={styles.notesTextarea}
            placeholder="Design notes, assumptions, reminders…"
            value={notes}
            rows={4}
            onChange={(e) => setNotes(e.target.value)}
          />
        </details>
      </div>
    </div>
  )
}
