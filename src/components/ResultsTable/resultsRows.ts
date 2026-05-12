// Row-building functions for the ResultsTable component.
// Each function takes a DesignResult and returns a typed row array.
import type { DesignResult } from '../../engine/types'

/** A single row in the results table. */
export interface ResultRow {
  label:      string
  symbol:     string
  value:      string
  equationId?: string
  status?:    'normal' | 'warning' | 'error'
}

/** Format a frequency value as Hz / kHz / MHz. */
export function formatHz(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`
  return `${hz.toFixed(0)} Hz`
}

/** Duty cycle status — error at extreme values, warning near limits. */
function dutyStatus(d: number): 'normal' | 'warning' | 'error' {
  if (d > 0.9 || d < 0.1)  return 'error'
  if (d > 0.82 || d < 0.15) return 'warning'
  return 'normal'
}

/** Build the fundamental design-value rows (D, L, C, Ipeak, η, f₀, Icrit). */
export function buildFundamentalRows(result: DesignResult): ResultRow[] {
  const rows: ResultRow[] = [
    { label: 'Duty Cycle',        symbol: 'D',     value: `${(result.dutyCycle * 100).toFixed(2)} %`,      equationId: 'duty_cycle',   status: dutyStatus(result.dutyCycle) },
    { label: 'Inductance',        symbol: 'L',     value: `${(result.inductance * 1e6).toFixed(3)} µH`,    equationId: 'inductance' },
    { label: 'Output Capacitance',symbol: 'C',     value: `${(result.capacitance * 1e6).toFixed(2)} µF`,   equationId: 'capacitance' },
    { label: 'Peak Current',      symbol: 'I_pk',  value: `${result.peakCurrent.toFixed(3)} A` },
  ]

  if (result.efficiency != null) {
    rows.push({ label: 'Efficiency', symbol: 'η', value: `${(result.efficiency * 100).toFixed(2)} %`, equationId: 'efficiency', status: result.efficiency < 0.7 ? 'warning' : 'normal' })
  }

  if (result.inductance && result.capacitance) {
    const f0 = 1 / (2 * Math.PI * Math.sqrt(result.inductance * result.capacitance))
    rows.push({ label: 'LC Corner Frequency', symbol: 'f₀', value: formatHz(f0), equationId: 'lc_corner' })
  }

  if (result.ccm_dcm_boundary != null) {
    rows.push({ label: 'CCM/DCM Boundary', symbol: 'I_crit', value: `${result.ccm_dcm_boundary.toFixed(3)} A`, status: result.operating_mode === 'DCM' ? 'warning' : 'normal' })
  }

  return rows
}

/** Push a loss row when the value is non-null and greater than zero. */
function pushLoss(rows: ResultRow[], label: string, symbol: string, value: number | undefined | null, eqId?: string): void {
  if (value != null && value > 0) rows.push({ label, symbol, value: `${value.toFixed(4)} W`, equationId: eqId })
}

/** Build the loss breakdown rows from result.losses; returns [] when losses are absent. */
export function buildLossRows(result: DesignResult): ResultRow[] {
  const losses = result.losses
  if (!losses) return []
  const rows: ResultRow[] = []

  pushLoss(rows, 'MOSFET Q1 Conduction', 'P_cond',  losses.mosfet_conduction,  'mosfet_conduction')
  pushLoss(rows, 'MOSFET Q1 Switching',  'P_sw',    losses.mosfet_switching,   'mosfet_switching')
  pushLoss(rows, 'Gate Drive',           'P_gate',  losses.mosfet_gate)
  pushLoss(rows, 'Inductor Copper (DCR)','P_DCR',   losses.inductor_copper)
  pushLoss(rows, 'Inductor Core',        'P_core',  losses.inductor_core)
  pushLoss(rows, 'Diode Conduction',     'P_diode', losses.diode_conduction)
  pushLoss(rows, 'Q2 Sync Conduction',   'P_sync',  losses.sync_conduction)
  pushLoss(rows, 'Q2 Dead-time Overhead','P_dead',  losses.sync_dead_time)
  pushLoss(rows, 'Capacitor ESR',        'P_ESR',   losses.capacitor_esr)
  pushLoss(rows, 'Primary Copper',       'P_pri',   losses.primaryCopper)
  pushLoss(rows, 'Secondary Copper',     'P_sec',   losses.secondaryCopper)
  pushLoss(rows, 'Core Loss',            'P_core',  losses.core)
  pushLoss(rows, 'Clamp / Snubber',      'P_clamp', losses.clamp)

  if (losses.total > 0) rows.push({ label: 'Total Loss', symbol: 'P_tot', value: `${losses.total.toFixed(4)} W` })
  return rows
}

/** Build the topology-specific rows (phases, turns ratio, clamp voltage, etc.). */
export function buildTopoRows(result: DesignResult): ResultRow[] {
  const rows: ResultRow[] = []
  const r = result as Record<string, unknown>

  if (result.phases != null && result.phases > 1) {
    rows.push({ label: 'Phases (interleaved)', symbol: 'N', value: `${result.phases}` })
    if (typeof r.phase_inductance === 'number') {
      rows.push({ label: 'Per-Phase Inductance', symbol: 'L_ph', value: `${(r.phase_inductance * 1e6).toFixed(3)} µH`, equationId: 'inductance' })
    }
    if (typeof r.output_ripple_cancel === 'number') {
      rows.push({ label: 'Ripple Cancellation K', symbol: 'K', value: `${(r.output_ripple_cancel as number).toFixed(3)}` })
    }
  }

  if (result.turnsRatio    != null) rows.push({ label: 'Turns Ratio (Np/Ns)',  symbol: 'n',       value: `${result.turnsRatio.toFixed(3)}` })
  if (result.clampVoltage  != null) rows.push({ label: 'Clamp Voltage',        symbol: 'V_clamp', value: `${result.clampVoltage.toFixed(1)} V` })
  if (result.couplingCapacitance != null) rows.push({ label: 'Coupling Capacitor', symbol: 'C_c', value: `${(result.couplingCapacitance * 1e6).toFixed(2)} µF` })
  if (result.mosfetVdsMax  != null) rows.push({ label: 'MOSFET Vds max', symbol: 'V_ds', value: `${result.mosfetVdsMax.toFixed(1)} V`, status: result.mosfetVdsMax > 100 ? 'warning' : 'normal' })

  return rows
}
