import React, { useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import { EQUATIONS } from '../../engine/equation-metadata'
import styles from './ResultsTable.module.css'

// ── Symbol renderer ───────────────────────────────────────────────────────────

function Sym({ text }: { text: string }): React.ReactElement {
  const parts: React.ReactNode[] = []
  let buf = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '_' && i + 1 < text.length) {
      if (buf) { parts.push(buf); buf = '' }
      i++
      let sub = ''
      while (i < text.length && !/[ ×()+\-/=,]/.test(text[i])) sub += text[i++]
      parts.push(<sub key={`s${parts.length}`}>{sub}</sub>)
    } else {
      buf += text[i++]
    }
  }
  if (buf) parts.push(buf)
  return <>{parts}</>
}

// ── Row definition ────────────────────────────────────────────────────────────

interface ResultRow {
  label: string
  symbol: string
  value: string
  equationId?: string
  status?: 'normal' | 'warning' | 'error'
}

function formatHz(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`
  return `${hz.toFixed(0)} Hz`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResultsTable(): React.ReactElement {
  const spec              = useDesignStore((s) => s.spec)
  const result            = useDesignStore((s) => s.result)
  const activeEquationId  = useDesignStore((s) => s.activeEquationId)
  const setActiveEquation = useDesignStore((s) => s.setActiveEquationId)

  const openEquation = useCallback((id: string) => {
    setActiveEquation(activeEquationId === id ? null : id)
  }, [activeEquationId, setActiveEquation])

  if (!result) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>Run simulation to see computed results</div>
      </div>
    )
  }

  // ── Build rows ────────────────────────────────────────────────────────────

  const fundamental: ResultRow[] = [
    {
      label: 'Duty Cycle',
      symbol: 'D',
      value: `${(result.dutyCycle * 100).toFixed(2)} %`,
      equationId: 'duty_cycle',
      status: result.dutyCycle > 0.9 || result.dutyCycle < 0.1 ? 'error'
            : result.dutyCycle > 0.82 || result.dutyCycle < 0.15 ? 'warning' : 'normal',
    },
    {
      label: 'Inductance',
      symbol: 'L',
      value: `${(result.inductance * 1e6).toFixed(3)} µH`,
      equationId: 'inductance',
    },
    {
      label: 'Output Capacitance',
      symbol: 'C',
      value: `${(result.capacitance * 1e6).toFixed(2)} µF`,
      equationId: 'capacitance',
    },
    {
      label: 'Peak Current',
      symbol: 'I_pk',
      value: `${result.peakCurrent.toFixed(3)} A`,
    },
  ]

  if (result.efficiency != null) {
    fundamental.push({
      label: 'Efficiency',
      symbol: 'η',
      value: `${(result.efficiency * 100).toFixed(2)} %`,
      equationId: 'efficiency',
      status: result.efficiency < 0.7 ? 'warning' : 'normal',
    })
  }

  if (result.inductance && result.capacitance) {
    const f0 = 1 / (2 * Math.PI * Math.sqrt(result.inductance * result.capacitance))
    fundamental.push({
      label: 'LC Corner Frequency',
      symbol: 'f₀',
      value: formatHz(f0),
      equationId: 'lc_corner',
    })
  }

  if (result.ccm_dcm_boundary != null) {
    fundamental.push({
      label: 'CCM/DCM Boundary',
      symbol: 'I_crit',
      value: `${result.ccm_dcm_boundary.toFixed(3)} A`,
      status: result.operating_mode === 'DCM' ? 'warning' : 'normal',
    })
  }

  // ── Losses ────────────────────────────────────────────────────────────────

  const lossRows: ResultRow[] = []
  const losses = result.losses

  if (losses) {
    if (losses.mosfet_conduction != null && losses.mosfet_conduction > 0) {
      lossRows.push({
        label: 'MOSFET Q1 Conduction',
        symbol: 'P_cond',
        value: `${losses.mosfet_conduction.toFixed(4)} W`,
        equationId: 'mosfet_conduction',
      })
    }
    if (losses.mosfet_switching != null && losses.mosfet_switching > 0) {
      lossRows.push({
        label: 'MOSFET Q1 Switching',
        symbol: 'P_sw',
        value: `${losses.mosfet_switching.toFixed(4)} W`,
        equationId: 'mosfet_switching',
      })
    }
    if (losses.mosfet_gate != null && losses.mosfet_gate > 0) {
      lossRows.push({
        label: 'Gate Drive',
        symbol: 'P_gate',
        value: `${losses.mosfet_gate.toFixed(4)} W`,
      })
    }
    if (losses.inductor_copper != null && losses.inductor_copper > 0) {
      lossRows.push({
        label: 'Inductor Copper (DCR)',
        symbol: 'P_DCR',
        value: `${losses.inductor_copper.toFixed(4)} W`,
      })
    }
    if (losses.inductor_core != null && losses.inductor_core > 0) {
      lossRows.push({
        label: 'Inductor Core',
        symbol: 'P_core',
        value: `${losses.inductor_core.toFixed(4)} W`,
      })
    }
    if (losses.diode_conduction != null && losses.diode_conduction > 0) {
      lossRows.push({
        label: 'Diode Conduction',
        symbol: 'P_diode',
        value: `${losses.diode_conduction.toFixed(4)} W`,
      })
    }
    if (losses.sync_conduction != null && losses.sync_conduction > 0) {
      lossRows.push({
        label: 'Q2 Sync Conduction',
        symbol: 'P_sync',
        value: `${losses.sync_conduction.toFixed(4)} W`,
      })
    }
    if (losses.sync_dead_time != null && losses.sync_dead_time > 0) {
      lossRows.push({
        label: 'Q2 Dead-time Overhead',
        symbol: 'P_dead',
        value: `${losses.sync_dead_time.toFixed(4)} W`,
      })
    }
    if (losses.capacitor_esr != null && losses.capacitor_esr > 0) {
      lossRows.push({
        label: 'Capacitor ESR',
        symbol: 'P_ESR',
        value: `${losses.capacitor_esr.toFixed(4)} W`,
      })
    }
    // Flyback/forward losses
    if (losses.primaryCopper != null) {
      lossRows.push({ label: 'Primary Copper', symbol: 'P_pri', value: `${losses.primaryCopper.toFixed(4)} W` })
    }
    if (losses.secondaryCopper != null) {
      lossRows.push({ label: 'Secondary Copper', symbol: 'P_sec', value: `${losses.secondaryCopper.toFixed(4)} W` })
    }
    if (losses.core != null) {
      lossRows.push({ label: 'Core Loss', symbol: 'P_core', value: `${losses.core.toFixed(4)} W` })
    }
    if (losses.clamp != null) {
      lossRows.push({ label: 'Clamp / Snubber', symbol: 'P_clamp', value: `${losses.clamp.toFixed(4)} W` })
    }
    if (losses.total > 0) {
      lossRows.push({ label: 'Total Loss', symbol: 'P_tot', value: `${losses.total.toFixed(4)} W` })
    }
  }

  // ── Topology-specific ─────────────────────────────────────────────────────

  const topoRows: ResultRow[] = []

  if (result.phases != null && result.phases > 1) {
    topoRows.push({ label: 'Phases (interleaved)', symbol: 'N', value: `${result.phases}` })
    if (result.phase_inductance != null) {
      topoRows.push({ label: 'Per-Phase Inductance', symbol: 'L_ph', value: `${(result.phase_inductance * 1e6).toFixed(3)} µH`, equationId: 'inductance' })
    }
    if (result.output_ripple_cancel != null) {
      topoRows.push({ label: 'Ripple Cancellation K', symbol: 'K', value: `${result.output_ripple_cancel.toFixed(3)}` })
    }
  }

  if (result.turnsRatio != null) {
    topoRows.push({ label: 'Turns Ratio (Np/Ns)', symbol: 'n', value: `${result.turnsRatio.toFixed(3)}` })
  }
  if (result.clampVoltage != null) {
    topoRows.push({ label: 'Clamp Voltage', symbol: 'V_clamp', value: `${result.clampVoltage.toFixed(1)} V` })
  }
  if (result.couplingCapacitance != null) {
    topoRows.push({ label: 'Coupling Capacitor', symbol: 'C_c', value: `${(result.couplingCapacitance * 1e6).toFixed(2)} µF` })
  }
  if (result.mosfetVdsMax != null) {
    topoRows.push({
      label: 'MOSFET Vds max',
      symbol: 'V_ds',
      value: `${result.mosfetVdsMax.toFixed(1)} V`,
      status: result.mosfetVdsMax > 100 ? 'warning' : 'normal',
    })
  }

  // ── Render helper ─────────────────────────────────────────────────────────

  const renderRow = (row: ResultRow, idx: number) => {
    const hasEq = !!row.equationId && EQUATIONS.some((e) => e.id === row.equationId)
    const isActive = row.equationId === activeEquationId
    return (
      <div
        key={idx}
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
          <button
            className={styles.exploreBtn}
            onClick={(e) => { e.stopPropagation(); if (row.equationId) openEquation(row.equationId) }}
            tabIndex={-1}
          >
            ƒ
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* ── Operating mode badge ── */}
      {result.operating_mode && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={styles.groupTitle} style={{ padding: 0, borderBottom: 'none', margin: 0 }}>Mode</span>
          <span className={`${styles.modeBadge} ${styles[result.operating_mode.toLowerCase() as 'ccm' | 'dcm' | 'boundary']}`}>
            {result.operating_mode}
          </span>
        </div>
      )}

      {/* ── Fundamental results ── */}
      <div className={styles.groupTitle}>Design Values</div>
      {fundamental.map(renderRow)}

      {/* ── Topology-specific ── */}
      {topoRows.length > 0 && (
        <>
          <div className={styles.groupTitle}>Topology Details</div>
          {topoRows.map(renderRow)}
        </>
      )}

      {/* ── Losses ── */}
      {lossRows.length > 0 && (
        <>
          <div className={styles.groupTitle}>Loss Breakdown</div>
          {lossRows.map(renderRow)}
        </>
      )}

      {/* ── Warnings ── */}
      {result.warnings.length > 0 && (
        <>
          <div className={styles.groupTitle}>Warnings</div>
          <div className={styles.warnings}>
            {result.warnings.map((w, i) => (
              <div key={i} className={styles.warningItem}>{w}</div>
            ))}
          </div>
        </>
      )}

      <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 10, marginTop: 12, fontFamily: 'Consolas, monospace' }}>
        Click any ƒ button to explore the equation interactively
      </div>
    </div>
  )
}
