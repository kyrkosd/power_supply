// Efficiency curve computation, loss segment definitions, and shared types for LossBreakdown.
import type { DesignSpec, DesignResult } from '../../engine/types'

/** Keyed loss component names produced by the buck topology loss model. */
export type LossKey =
  | 'mosfet_conduction' | 'mosfet_switching' | 'mosfet_gate'
  | 'inductor_copper'   | 'inductor_core'
  | 'diode_conduction'  | 'sync_conduction'  | 'sync_dead_time'
  | 'capacitor_esr'

/** All named loss values returned by the engine, plus computed totals. */
export interface LossBreakdownValues {
  mosfet_conduction: number; mosfet_switching: number; mosfet_gate: number
  inductor_copper:   number; inductor_core:    number
  diode_conduction:  number; sync_conduction:  number; sync_dead_time: number
  capacitor_esr:     number; total: number;            efficiency: number
}

/** Display metadata for a single stacked-bar segment. */
export interface LossSegment { key: LossKey; label: string; color: string }

/** Ordered list of loss segments and their bar colours. */
export const LOSS_SEGMENTS: LossSegment[] = [
  { key: 'mosfet_conduction', label: 'Q1 conduction',        color: '#1f4f8b' },
  { key: 'mosfet_switching',  label: 'Q1 switching',         color: '#3f72ff' },
  { key: 'mosfet_gate',       label: 'Q1 gate drive',        color: '#8fb9ff' },
  { key: 'inductor_copper',   label: 'Inductor copper/DCR',  color: '#f88f1f' },
  { key: 'inductor_core',     label: 'Inductor core loss',   color: '#ffb76b' },
  { key: 'diode_conduction',  label: 'Diode conduction',     color: '#d9382f' },
  { key: 'sync_conduction',   label: 'Q2 conduction (sync)', color: '#22c55e' },
  { key: 'sync_dead_time',    label: 'Q2 overhead (sync)',   color: '#86efac' },
  { key: 'capacitor_esr',     label: 'Capacitor ESR',        color: '#7d7d7d' },
]

/** Main-FET device assumptions (mirrors the constants in buck.ts). */
const DA = {
  rdsOn: 0.02, trise: 25e-9, tfall: 25e-9, qg: 12e-9,
  vf: 0.7,     dcr:   0.045, esr:  0.02,   coreFactor: 0.02,
}

/** Sync-FET overhead assumptions (body-diode dead time, Coss, gate charge). */
const SA = { rdsSync: 0.008, tDead: 30e-9, coss: 100e-12, qgSync: 15e-9, vfBody: 0.7 }

/** One point on the efficiency-vs-load curve. */
export interface EffPoint { loadCurrent: number; efficiency: number }

/** Computes per-phase ripple cancellation factor K for N interleaved phases at duty D. */
function rippleK(N: number, D: number): number {
  const ND = N * D, delta = ND - Math.floor(ND)
  return (delta < 1e-6 || delta > 1 - 1e-6) ? 0 : Math.min((delta * (1 - delta)) / (N * D * (1 - D)), 1)
}

/** Computes total losses at one load point for N phases, returning efficiency. */
function evalOnePoint(
  I: number, D: number, L: number, fsw: number, Vin: number, N: number, syncMode: boolean,
): number {
  const I1   = I / N
  const dIL  = Math.abs((Vin * (1 - D) * D) / (L * fsw * (Vin))) // simplified Vout(1-D)/Lfsw
  const Ipk  = I1 + dIL / 2
  const Irms = Math.sqrt(I1 ** 2 + dIL ** 2 / 12)
  const Ico  = (rippleK(N, D) * dIL) / (2 * Math.sqrt(3))
  const Pcond = DA.rdsOn * I ** 2 * D / N
  const Psw   = N * 0.5 * Vin * Ipk * (DA.trise + DA.tfall) * fsw
  const Pgd   = N * DA.qg  * Vin * fsw
  const PLcu  = N * DA.dcr * Irms ** 2
  const PLco  = N * DA.coreFactor * I1 * dIL
  const Pdiod = syncMode ? 0 : DA.vf * I * (1 - D)
  const Psync = syncMode
    ? N * SA.rdsSync * Irms ** 2 * (1 - D)
      + N * (SA.vfBody * I1 * 2 * SA.tDead * fsw + 0.5 * SA.coss * Vin ** 2 * fsw + SA.qgSync * Vin * fsw)
    : 0
  const Pesr  = Ico ** 2 * DA.esr
  return Pcond + Psw + Pgd + PLcu + PLco + Pdiod + Psync + Pesr
}

/**
 * Computes a 10-point efficiency-vs-load curve for a buck converter.
 * @param spec     Design specification (Vout, VinMax, Iout, fsw).
 * @param result   Engine result providing inductance and phase count.
 * @param phases   Number of interleaved phases.
 * @param syncMode When true, replaces diode loss with sync-FET model.
 */
export function computeBuckEfficiencyCurve(
  spec: DesignSpec, result: DesignResult, phases: number, syncMode = false,
): EffPoint[] {
  const N = Math.max(1, phases)
  const D = Math.min(Math.max(spec.vout / spec.vinMax, 0.01), 0.99)
  const L = (N > 1 && (result as Record<string, unknown>).phase_inductance)
    ? (result as Record<string, number>).phase_inductance
    : result.inductance

  return Array.from({ length: 10 }, (_, i) => {
    const Iload  = spec.iout * (0.1 + i * 0.1)
    const Ptot   = evalOnePoint(Iload, D, L, spec.fsw, spec.vinMax, N, syncMode)
    const Pout   = spec.vout * Iload
    return { loadCurrent: Iload, efficiency: Pout <= 0 ? 0 : (Pout / (Pout + Ptot)) * 100 }
  })
}

/**
 * Returns the single-phase diode/sync efficiency curve for buck.
 * Returns an empty array for all other topologies.
 */
export function createEfficiencyCurve(
  spec: DesignSpec, result: DesignResult, topology: string,
): EffPoint[] {
  if (topology !== 'buck') return []
  return computeBuckEfficiencyCurve(spec, result, 1, spec.rectification === 'synchronous')
}
