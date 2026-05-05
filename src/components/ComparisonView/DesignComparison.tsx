import React, { useEffect, useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { ComparisonSlot } from '../../store/design-store'
import type { DesignResult, DesignSpec } from '../../engine/types'
import type { TopologyId } from '../../store/design-store'
import { fmtL, fmtC, fmtHz } from '../../export/format-utils'
import styles from './DesignComparison.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: number): string { return `${(v * 100).toFixed(1)} %` }

function getEfficiency(spec: DesignSpec, result: DesignResult): number {
  return result.efficiency ?? spec.efficiency
}

function getTotalLoss(spec: DesignSpec, result: DesignResult): number | null {
  if (result.losses?.total != null) return result.losses.total
  const eff = getEfficiency(spec, result)
  const pout = spec.vout * spec.iout
  // Estimated from Pout = η × Pin → Ploss = Pout × (1/η - 1)
  if (eff > 0 && eff < 1) return pout * (1 / eff - 1)
  return null
}

type WinSide = 'A' | 'B' | 'tie' | 'na'

function higherWins(a: number | null, b: number | null): WinSide {
  if (a == null || b == null) return 'na'
  if (a > b + 1e-9) return 'A'
  if (b > a + 1e-9) return 'B'
  return 'tie'
}

function lowerWins(a: number | null, b: number | null): WinSide {
  return higherWins(b, a)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EffBar({ value, isWinner }: { value: number; isWinner: boolean }): React.ReactElement {
  return (
    <div className={styles.barWrap}>
      <div className={styles.barTrack}>
        <div
          className={isWinner ? styles.barFill : styles.barFillLose}
          style={{ width: `${Math.min(value * 100, 100).toFixed(1)}%` }}
        />
      </div>
      <span>{pct(value)}</span>
    </div>
  )
}

function WarnCell({ warnings }: { warnings: string[] }): React.ReactElement {
  if (warnings.length === 0) return <span className={styles.noWarn}>None</span>
  return (
    <div className={styles.warnList}>
      {warnings.slice(0, 3).map((w, i) => (
        <span key={i} className={styles.warnPill}>{w}</span>
      ))}
      {warnings.length > 3 && (
        <span className={styles.warnPill}>+{warnings.length - 3} more…</span>
      )}
    </div>
  )
}

// ── Row helpers ───────────────────────────────────────────────────────────────

type Side = 'A' | 'B'

function cellClass(side: Side, winner: WinSide): string {
  if (winner === 'na' || winner === 'tie') return ''
  return winner === side ? styles.win : styles.lose
}

// ── Main component ────────────────────────────────────────────────────────────

const TOPOLOGY_LABELS: Record<string, string> = {
  buck: 'Buck (Step-Down)',
  boost: 'Boost (Step-Up)',
  'buck-boost': 'Buck-Boost',
  flyback: 'Flyback',
  forward: 'Forward',
  sepic: 'SEPIC',
}

export function DesignComparison(): React.ReactElement | null {
  const comparisonSlot  = useDesignStore((s) => s.comparisonSlot)
  const isComparing     = useDesignStore((s) => s.isComparing)
  const setIsComparing  = useDesignStore((s) => s.setIsComparing)
  const clearComparison = useDesignStore((s) => s.clearComparison)

  const currentTopology = useDesignStore((s) => s.topology)
  const currentSpec     = useDesignStore((s) => s.spec)
  const currentResult   = useDesignStore((s) => s.result)

  const close = useCallback(() => setIsComparing(false), [setIsComparing])

  // Close on Escape
  useEffect(() => {
    if (!isComparing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isComparing, close])

  if (!isComparing || !comparisonSlot || !currentResult) return null

  const a: ComparisonSlot = comparisonSlot
  const b: ComparisonSlot = { topology: currentTopology, spec: currentSpec, result: currentResult }

  // ── Derived metrics ──────────────────────────────────────────────────────

  const effA = getEfficiency(a.spec, a.result)
  const effB = getEfficiency(b.spec, b.result)
  const effWin = higherWins(effA, effB)

  const lossA = getTotalLoss(a.spec, a.result)
  const lossB = getTotalLoss(b.spec, b.result)
  const lossWin = lowerWins(lossA, lossB)

  const lWin = lowerWins(a.result.inductance, b.result.inductance)
  const cWin = lowerWins(a.result.capacitance, b.result.capacitance)
  const iWin = lowerWins(a.result.peakCurrent, b.result.peakCurrent)
  const warnWin = lowerWins(a.result.warnings.length, b.result.warnings.length)

  // Count wins (efficiency, losses, peak current, fewer warnings)
  const wins: WinSide[] = [effWin, lossWin, iWin, warnWin]
  const aWins = wins.filter((w) => w === 'A').length
  const bWins = wins.filter((w) => w === 'B').length

  const summaryBadgeClass = aWins > bWins ? styles.badgeA : bWins > aWins ? styles.badgeB : styles.badgeTie
  const summaryText =
    aWins > bWins ? `Design A wins ${aWins}/${wins.length} metrics`
    : bWins > aWins ? `Design B wins ${bWins}/${wins.length} metrics`
    : 'Designs are comparable'

  // ── Render ───────────────────────────────────────────────────────────────

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

              {/* Topology */}
              <tr>
                <td className={styles.rowLabel}>Topology</td>
                <td className={styles.colA}>{TOPOLOGY_LABELS[a.topology] ?? a.topology}</td>
                <td className={styles.colB}>{TOPOLOGY_LABELS[b.topology] ?? b.topology}</td>
              </tr>

              {/* Key Specs */}
              <tr>
                <td className={styles.rowLabel}>Key Specs</td>
                <td className={styles.colA}>
                  {a.spec.vout} V @ {a.spec.iout} A
                  <span className={styles.sub}>
                    Vin {a.spec.vinMin}–{a.spec.vinMax} V &nbsp;·&nbsp; {fmtHz(a.spec.fsw)}
                  </span>
                </td>
                <td className={styles.colB}>
                  {b.spec.vout} V @ {b.spec.iout} A
                  <span className={styles.sub}>
                    Vin {b.spec.vinMin}–{b.spec.vinMax} V &nbsp;·&nbsp; {fmtHz(b.spec.fsw)}
                  </span>
                </td>
              </tr>

              {/* Duty Cycle */}
              <tr>
                <td className={styles.rowLabel}>Duty Cycle</td>
                <td className={styles.colA}>{(a.result.dutyCycle * 100).toFixed(1)} %</td>
                <td className={styles.colB}>{(b.result.dutyCycle * 100).toFixed(1)} %</td>
              </tr>

              {/* Inductance */}
              <tr>
                <td className={styles.rowLabel}>Inductance</td>
                <td className={`${styles.colA} ${cellClass('A', lWin)}`}>{fmtL(a.result.inductance)}</td>
                <td className={`${styles.colB} ${cellClass('B', lWin)}`}>{fmtL(b.result.inductance)}</td>
              </tr>

              {/* Capacitance */}
              <tr>
                <td className={styles.rowLabel}>Capacitance</td>
                <td className={`${styles.colA} ${cellClass('A', cWin)}`}>{fmtC(a.result.capacitance)}</td>
                <td className={`${styles.colB} ${cellClass('B', cWin)}`}>{fmtC(b.result.capacitance)}</td>
              </tr>

              {/* Peak Current */}
              <tr>
                <td className={styles.rowLabel}>Peak Current</td>
                <td className={`${styles.colA} ${cellClass('A', iWin)}`}>
                  {a.result.peakCurrent.toFixed(2)} A
                </td>
                <td className={`${styles.colB} ${cellClass('B', iWin)}`}>
                  {b.result.peakCurrent.toFixed(2)} A
                </td>
              </tr>

              {/* Efficiency */}
              <tr>
                <td className={styles.rowLabel}>Efficiency</td>
                <td className={`${styles.colA} ${cellClass('A', effWin)}`}>
                  <EffBar value={effA} isWinner={effWin === 'A' || effWin === 'tie'} />
                </td>
                <td className={`${styles.colB} ${cellClass('B', effWin)}`}>
                  <EffBar value={effB} isWinner={effWin === 'B' || effWin === 'tie'} />
                </td>
              </tr>

              {/* Total Losses */}
              <tr>
                <td className={styles.rowLabel}>Total Losses</td>
                <td className={`${styles.colA} ${cellClass('A', lossWin)}`}>
                  {lossA != null ? `${lossA.toFixed(2)} W` : '—'}
                  {a.result.losses == null && lossA != null && (
                    <span className={styles.sub}>estimated</span>
                  )}
                </td>
                <td className={`${styles.colB} ${cellClass('B', lossWin)}`}>
                  {lossB != null ? `${lossB.toFixed(2)} W` : '—'}
                  {b.result.losses == null && lossB != null && (
                    <span className={styles.sub}>estimated</span>
                  )}
                </td>
              </tr>

              {/* Operating Mode */}
              <tr>
                <td className={styles.rowLabel}>Mode</td>
                <td className={styles.colA}>{a.result.operating_mode ?? 'CCM'}</td>
                <td className={styles.colB}>{b.result.operating_mode ?? 'CCM'}</td>
              </tr>

              {/* Warnings */}
              <tr>
                <td className={styles.rowLabel}>Warnings</td>
                <td className={`${styles.colA} ${cellClass('A', warnWin)}`}>
                  <WarnCell warnings={a.result.warnings} />
                </td>
                <td className={`${styles.colB} ${cellClass('B', warnWin)}`}>
                  <WarnCell warnings={b.result.warnings} />
                </td>
              </tr>

            </tbody>
          </table>
        </div>

        <div className={styles.footer}>
          <span className={styles.summaryLabel}>
            Based on {wins.length} comparable metrics (efficiency, losses, peak current, warnings)
          </span>
          <span className={`${styles.badge} ${summaryBadgeClass}`}>{summaryText}</span>
          <button className={styles.clearBtn} onClick={clearComparison} title="Clear saved design A">
            Clear A
          </button>
        </div>

      </div>
    </div>
  )
}
