// Results table: duty cycle, inductance, capacitance, losses, and topology details
// with clickable equation explorer links.
import React, { useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import { EQUATIONS } from '../../engine/equation-metadata'
import { buildFundamentalRows, buildLossRows, buildTopoRows } from './resultsRows'
import type { ResultRow } from './resultsRows'
import styles from './ResultsTable.module.css'

// ── Symbol renderer ───────────────────────────────────────────────────────────

/** Renders a symbol string with underscore-delimited subscripts as `<sub>` elements. */
function Sym({ text }: { text: string }): React.ReactElement {
  const parts: React.ReactNode[] = []
  let buf = '', i = 0
  while (i < text.length) {
    if (text[i] === '_' && i + 1 < text.length) {
      if (buf) { parts.push(buf); buf = '' }
      i++
      let sub = ''
      while (i < text.length && !/[ ×()+\-/=,]/.test(text[i])) sub += text[i++]
      parts.push(<sub key={`s${parts.length}`}>{sub}</sub>)
    } else { buf += text[i++] }
  }
  if (buf) parts.push(buf)
  return <>{parts}</>
}

// ── Row renderer ──────────────────────────────────────────────────────────────

interface RowCellProps {
  row:             ResultRow
  activeEquationId: string | null
  openEquation:    (id: string) => void
}

/** Renders a single result row with optional equation-explorer link and status colour. */
function RowCell({ row, activeEquationId, openEquation }: RowCellProps): React.ReactElement {
  const hasEq   = !!row.equationId && EQUATIONS.some((e) => e.id === row.equationId)
  const isActive = row.equationId === activeEquationId
  return (
    <div
      className={`${styles.row} ${hasEq ? styles.clickable : ''} ${isActive ? styles.active : ''}`}
      onClick={hasEq && row.equationId ? () => openEquation(row.equationId!) : undefined}
      title={hasEq ? `Click to explore the ${row.label} equation` : undefined}
    >
      <span className={styles.symbol}><Sym text={row.symbol} /></span>
      <span className={styles.label}>{row.label}</span>
      <span className={`${styles.value} ${row.status === 'warning' ? styles.warning : row.status === 'error' ? styles.error : ''}`}>
        {row.value}
      </span>
      {hasEq && (
        <button className={styles.exploreBtn} onClick={(e) => { e.stopPropagation(); if (row.equationId) openEquation(row.equationId) }} tabIndex={-1}>ƒ</button>
      )}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

/** Thin section heading divider between row groups. */
function GroupTitle({ title }: { title: string }): React.ReactElement {
  return <div className={styles.groupTitle}>{title}</div>
}

// ── Main component ────────────────────────────────────────────────────────────

/** Results table listing fundamental values, topology details, and loss breakdown. */
export function ResultsTable(): React.ReactElement {
  const result            = useDesignStore((s) => s.result)
  const activeEquationId  = useDesignStore((s) => s.activeEquationId)
  const setActiveEquation = useDesignStore((s) => s.setActiveEquationId)

  const openEquation = useCallback(
    (id: string) => setActiveEquation(activeEquationId === id ? null : id),
    [activeEquationId, setActiveEquation],
  )

  if (!result) {
    return <div className={styles.container}><div className={styles.emptyState}>Run simulation to see computed results</div></div>
  }

  const fundamental = buildFundamentalRows(result)
  const lossRows    = buildLossRows(result)
  const topoRows    = buildTopoRows(result)

  const renderRows = (rows: ResultRow[]) =>
    rows.map((row, idx) => <RowCell key={idx} row={row} activeEquationId={activeEquationId} openEquation={openEquation} />)

  return (
    <div className={styles.container}>
      {/* Operating mode badge */}
      {result.operating_mode && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={styles.groupTitle} style={{ padding: 0, borderBottom: 'none', margin: 0 }}>Mode</span>
          <span className={`${styles.modeBadge} ${styles[result.operating_mode.toLowerCase() as 'ccm' | 'dcm' | 'boundary']}`}>
            {result.operating_mode}
          </span>
        </div>
      )}

      <GroupTitle title="Design Values" />
      {renderRows(fundamental)}

      {topoRows.length > 0 && (
        <>
          <GroupTitle title="Topology Details" />
          {renderRows(topoRows)}
        </>
      )}

      {lossRows.length > 0 && (
        <>
          <GroupTitle title="Loss Breakdown" />
          {renderRows(lossRows)}
        </>
      )}

      {result.warnings.length > 0 && (
        <>
          <GroupTitle title="Warnings" />
          <div className={styles.warnings}>
            {result.warnings.map((w, i) => <div key={i} className={styles.warningItem}>{w}</div>)}
          </div>
        </>
      )}

      <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 10, marginTop: 12, fontFamily: 'Consolas, monospace' }}>
        Click any ƒ button to explore the equation interactively
      </div>
    </div>
  )
}
