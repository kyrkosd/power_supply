// Per-phase component values for an N-phase interleaved buck converter.
// Erickson & Maksimovic §12.3 — N-phase interleaving.

import type { DesignSpec } from '../../types'

export interface BuckPhaseValues {
  L_phase:       number  // H — per-phase inductance
  deltaIL_phase: number  // A — per-phase ripple current
  I_phase_avg:   number  // A — per-phase DC current (Iout/N)
  peak_phase:    number  // A — per-phase peak current
  C_single:      number  // F — single-phase output capacitance
  C_multi:       number  // F — N-phase output capacitance (partially cancels)
  K_out:         number  // — — ripple-cancellation factor
}

/**
 * N-phase ripple-cancellation factor K_out.
 * δ = frac(N×D); K_out = δ(1−δ) / (N×D×(1−D)).
 * K_floor ensures a minimum inductance even at perfect-cancellation duty points.
 */
export function rippleCancelFactor(N: number, dutyCycle: number): { K_out: number; K_floor: number } {
  const ND    = N * dutyCycle
  const delta = ND - Math.floor(ND)
  const K_out = (delta < 1e-6 || delta > 1 - 1e-6)
    ? 0
    : Math.min((delta * (1 - delta)) / (N * dutyCycle * (1 - dutyCycle)), 1)
  return { K_out, K_floor: Math.max(K_out, 0.05) }
}

/**
 * Per-phase component values for an N-phase interleaved buck.
 * L_phase = L_single × K_floor; Cout_multi = Cout_single / N.
 * At N=1 these collapse to the standard single-phase values.
 */
export function computePhaseValues(spec: DesignSpec, dutyCycle: number, N: number): BuckPhaseValues {
  const { vout, iout, fsw, rippleRatio, voutRippleMax } = spec
  const ripple         = Math.max(rippleRatio, 0.05)
  const deltaIL_single = ripple * iout
  const L_single       = (vout * (1 - dutyCycle)) / (deltaIL_single * fsw)
  const rippleVoltage  = Math.max(voutRippleMax, 0.01 * vout)
  const C_single       = deltaIL_single / (8 * fsw * rippleVoltage)

  const { K_out, K_floor } = rippleCancelFactor(N, dutyCycle)
  const L_phase       = L_single * K_floor
  const deltaIL_phase = (vout * (1 - dutyCycle)) / (L_phase * fsw)
  const I_phase_avg   = iout / N
  const peak_phase    = I_phase_avg + deltaIL_phase / 2
  const C_multi       = Math.max(C_single / N, C_single * 0.02)

  return { L_phase, deltaIL_phase, I_phase_avg, peak_phase, C_single, C_multi, K_out }
}
