// Side-by-side comparison modal: Design A (saved) vs Design B (current).
import React, { useEffect, useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { ComparisonSlot } from '../../store/design-store'
import type { DesignResult, DesignSpec } from '../../engine/types'
import { fmtL, fmtC, fmtHz } from '../../export/format-utils'
import styles from './DesignComparison.module.css'

// ── Types and helpers ─────────────────────────────────────────────────────────

type WinSide = 'A' | 'B' | 'tie' | 'na'
type Side    = 'A' | 'B'

const TOPOLOGY_LABELS: Record<string, string> = {
  buck: 'Buck (Step-Down)', boost: 'Boost (Step-Up)', 'buck-boost': 'Buck-Boost',
  flyback: 'Flyback', forward: 'Forward', sepic: 'SEPIC',
}

/** Percentage string for display. */
function pct(v: number): string { return `${(v * 100).toFixed(1)} %` }

/** Effective efficiency: uses computed result first, falls back to spec target. */
function getEfficiency(spec: DesignSpec, result: DesignResult): number {
  return result.efficiency ?? spec.efficiency
}

/** Total power loss from losses object, or estimated from efficiency and Pout. */
function getTotalLoss(spec: DesignSpec, result: DesignResult): number | null {
  if (result.losses?.total != null) return result.losses.total
  const eff = getEfficiency(spec, result)
  const pout = spec.vout * spec.iout
  // Ploss = Pout × (1/η − 1)
  if (eff > 0 && eff < 1) return pout * (1 / eff - 1)
  return null
}

/** Higher value wins (e.g. efficiency). Epsilon avoids float equality issues. */
function higherWins(a: number | null, b: number | null): WinSide {
  if (a == null || b == null) return 'na'
  if (a > b + 1e-9) return 'A'
  if (b > a + 1e-9) return 'B'
  return 'tie'
}

/** Lower value wins (e.g. loss, peak current, warnings). */
const lowerWins = (a: number | null, b: number | null): WinSide => higherWins(b, a)

/** CSS win/lose class for a table cell based on which side wins. */
function cellClass(side: Side, winner: WinSide): string {
  if (winner === 'na' || winner === 'tie') return ''
  return winner === side ? styles.win : styles.lose
}

function isEffWinner(side: Side, winner: WinSide): boolean {
  return winner === side || winner === 'tie'
}

function getSummaryOutcome(aWins: number, bWins: number, total: number): { badge: string; text: string } {
  if (aWins > bWins) return { badge: styles.badgeA, text: `Design A wins ${aWins}/${total} metrics` }
  if (bWins > aWins) return { badge: styles.badgeB, text: `Design B wins ${bWins}/${total} metrics` }
  return { badge: styles.badgeTie, text: 'Designs are comparable' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Horizontal bar chart showing efficiency as a fraction of 100 %. */
function EffBar({ value, isWinner }: { value: number; isWinner: boolean }): React.ReactElement {
  return (
    <div className={styles.barWrap}>
      <div className={styles.barTrack}>
        <div className={isWinner ? styles.barFill : styles.barFillLose}
          style={{ width: `${Math.min(value * 100, 100).toFixed(1)}%` }} />
      </div>
      <span>{pct(value)}</span>
    </div>
  )
}

/** Loss display: shows W value or '—', with "estimated" tag when actual losses unavailable. */
function LossDisplay({ loss, hasActualLosses }: { loss: number | null; hasActualLosses: boolean }): React.ReactElement {
  if (loss == null) return <>—</>
  return <>{loss.toFixed(2)} W{!hasActualLosses && <span className={styles.sub}>estimated</span>}</>
}

/** Warning pills — up to 3 shown, overflow count appended. */
function WarnCell({ warnings }: { warnings: string[] }): React.ReactElement {
  if (warnings.length === 0) return <span className={styles.noWarn}>None</span>
  return (
    <div className={styles.warnList}>
      {warnings.slice(0, 3).map((w, i) => <span key={i} className={styles.warnPill}>{w}</span>)}
      {warnings.length > 3 && <span className={styles.warnPill}>+{warnings.length - 3} more…</span>}
    </div>
  )
}

/** Single table row with optional win/lose highlight on A and B columns. */
function Row({ label, a, b, aClass = '', bClass = '' }: {
  label: string; a: React.ReactNode; b: React.ReactNode; aClass?: string; bClass?: string
}): React.ReactElement {
  return (
    <tr>
      <td className={styles.rowLabel}>{label}</td>
      <td className={`${styles.colA} ${aClass}`}>{a}</td>
      <td className={`${styles.colB} ${bClass}`}>{b}</td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/** Comparison modal — opens via Ctrl+Shift+K, closes on Escape or backdrop click. */
export function DesignComparison(): React.ReactElement | null {
  const comparisonSlot  = useDesignStore((s) => s.comparisonSlot)
  const isComparing     = useDesignStore((s) => s.isComparing)
  const setIsComparing  = useDesignStore((s) => s.setIsComparing)
  const clearComparison = useDesignStore((s) => s.clearComparison)
  const currentTopology = useDesignStore((s) => s.topology)
  const currentSpec     = useDesignStore((s) => s.spec)
  const currentResult   = useDesignStore((s) => s.result)

  const close = useCallback(() => setIsComparing(false), [setIsComparing])

  useEffect(() => {
    if (!isComparing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isComparing, close])

  if (!isComparing || !comparisonSlot || !currentResult) return null

  const a: ComparisonSlot = comparisonSlot
  const b: ComparisonSlot = { topology: currentTopology, spec: currentSpec, result: currentResult }

  const effA = getEfficiency(a.spec, a.result), effB = getEfficiency(b.spec, b.result)
  const lossA = getTotalLoss(a.spec, a.result),  lossB = getTotalLoss(b.spec, b.result)
  const effWin  = higherWins(effA, effB)
  const lossWin = lowerWins(lossA, lossB)
  const lWin    = lowerWins(a.result.inductance, b.result.inductance)
  const cWin    = lowerWins(a.result.capacitance, b.result.capacitance)
  const iWin    = lowerWins(a.result.peakCurrent, b.result.peakCurrent)
  const warnWin = lowerWins(a.result.warnings.length, b.result.warnings.length)

  const wins = [effWin, lossWin, iWin, warnWin]
  const aWins = wins.filter((w) => w === 'A').length
  const bWins = wins.filter((w) => w === 'B').length
  const { badge: summaryBadge, text: summaryText } = getSummaryOutcome(aWins, bWins, wins.length)

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Design Comparison">

        <div className={styles.header}>
          <span className={styles.title}>Design Comparison — A vs B</span>
          <button className={styles.closeBtn} onClick={close} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.rowLabel}></th>
                <th>Design A (saved)</th>
                <th>Design B (current)</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Topology" a={TOPOLOGY_LABELS[a.topology] ?? a.topology} b={TOPOLOGY_LABELS[b.topology] ?? b.topology} />
              <Row label="Key Specs"
                a={<>{a.spec.vout} V @ {a.spec.iout} A<span className={styles.sub}>Vin {a.spec.vinMin}–{a.spec.vinMax} V · {fmtHz(a.spec.fsw)}</span></>}
                b={<>{b.spec.vout} V @ {b.spec.iout} A<span className={styles.sub}>Vin {b.spec.vinMin}–{b.spec.vinMax} V · {fmtHz(b.spec.fsw)}</span></>}
              />
              <Row label="Duty Cycle" a={`${(a.result.dutyCycle * 100).toFixed(1)} %`} b={`${(b.result.dutyCycle * 100).toFixed(1)} %`} />
              <Row label="Inductance"  a={fmtL(a.result.inductance)}  b={fmtL(b.result.inductance)}  aClass={cellClass('A', lWin)} bClass={cellClass('B', lWin)} />
              <Row label="Capacitance" a={fmtC(a.result.capacitance)} b={fmtC(b.result.capacitance)} aClass={cellClass('A', cWin)} bClass={cellClass('B', cWin)} />
              <Row label="Peak Current"
                a={`${a.result.peakCurrent.toFixed(2)} A`} b={`${b.result.peakCurrent.toFixed(2)} A`}
                aClass={cellClass('A', iWin)} bClass={cellClass('B', iWin)} />
              <Row label="Efficiency"
                a={<EffBar value={effA} isWinner={isEffWinner('A', effWin)} />}
                b={<EffBar value={effB} isWinner={isEffWinner('B', effWin)} />}
                aClass={cellClass('A', effWin)} bClass={cellClass('B', effWin)} />
              <Row label="Total Losses"
                a={<LossDisplay loss={lossA} hasActualLosses={a.result.losses != null} />}
                b={<LossDisplay loss={lossB} hasActualLosses={b.result.losses != null} />}
                aClass={cellClass('A', lossWin)} bClass={cellClass('B', lossWin)} />
              <Row label="Mode" a={a.result.operating_mode ?? 'CCM'} b={b.result.operating_mode ?? 'CCM'} />
              <Row label="Warnings"
                a={<WarnCell warnings={a.result.warnings} />} b={<WarnCell warnings={b.result.warnings} />}
                aClass={cellClass('A', warnWin)} bClass={cellClass('B', warnWin)} />
            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <span className={styles.summaryLabel}>Based on {wins.length} metrics (efficiency, losses, peak current, warnings)</span>
          <span className={`${styles.badge} ${summaryBadge}`}>{summaryText}</span>
          <button className={styles.clearBtn} onClick={clearComparison} title="Clear saved design A">Clear A</button>
        </div>

      </div>
    </div>
  )
}
