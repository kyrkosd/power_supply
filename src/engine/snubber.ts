// RCD clamp/snubber design for flyback and forward converters.
// References: TI Application Report SLUA107 "Flyback Converter Design",
//             Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §6.2.2

import type { DesignSpec, DesignResult, SnubberResult } from './types'

// SnubberResult is defined in types.ts (the pure-type leaf) so DesignResult can
// reference it without creating a circular import.
export type { SnubberResult }

export type SnubberTopology = 'flyback' | 'forward'

export const DEFAULT_LEAKAGE_RATIO = 0.02  // 2 % of magnetising inductance

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Primary peak current for the RCD clamp energy calculation.
 * Flyback: directly from result.peakCurrent (magnetising peak on primary).
 * Forward: derived from output inductor current and turns ratio (TI SLUA107 §2.1).
 */
function computeIpPeak(topologyId: SnubberTopology, spec: DesignSpec, result: DesignResult): number {
  if (topologyId === 'flyback') return result.peakCurrent
  const pout = spec.vout * spec.iout
  const eta  = Math.min(Math.max(spec.efficiency, 0.5), 1)
  const primaryCurrentAvg = pout / (eta * spec.vinMin)
  const deltaIm = 0.20 * primaryCurrentAvg  // 20 % ripple target (forward.ts §6)
  return spec.iout / (result.turnsRatio ?? 1) + deltaIm
}

/**
 * Compute RCD clamp component values from leakage energy.
 * E_lk = ½ × Llk × Ip²  (TI SLUA107 eq. 5).
 * V_clamp = 1.5 × Vin_max  (TI SLUA107 eq. 4).
 * R = V_clamp² / (E_lk × fsw)  (TI SLUA107 eq. 6).
 * C = 2 × E_lk / V_clamp²  (Erickson §6.2.2).
 */
function computeRcdValues(Llk: number, Ip_peak: number, vinMax: number, fsw: number) {
  const E_lk    = 0.5 * Llk * Ip_peak * Ip_peak
  const V_clamp = 1.5 * vinMax
  const R       = V_clamp ** 2 / (E_lk * fsw)
  const C       = (2 * E_lk) / V_clamp ** 2
  const P_dissipated = E_lk * fsw
  const diode_Vr     = V_clamp + vinMax  // TI SLUA107 §3.3
  return { V_clamp, R, C, P_dissipated, diode_Vr }
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Called by: flyback.ts (computeFlyback) and forward.ts (computeForward) — inline within the
// topology compute() call, before the result is returned to the worker. Running here rather
// than as a separate post-compute step means the clamp-power dissipation is available in the
// same result object that feeds the efficiency and thermal calculations, keeping the numbers
// consistent. A warning fires if P_dissipated > 5 % of Pout (see warnings.ts).
export function designSnubber(
  topologyId: SnubberTopology,
  spec: DesignSpec,
  result: DesignResult,
  leakage_ratio = DEFAULT_LEAKAGE_RATIO,
): SnubberResult {
  const Lm  = result.magnetizingInductance ?? result.inductance
  const Llk = leakage_ratio * Lm

  const Ip_peak = computeIpPeak(topologyId, spec, result)
  const { V_clamp, R, C, P_dissipated, diode_Vr } =
    computeRcdValues(Llk, Ip_peak, spec.vinMax, spec.fsw)

  return {
    type: 'RCD_clamp',
    leakage_inductance: Llk,
    V_clamp,
    R,
    C,
    P_dissipated,
    components: {
      R_value:          R,
      R_power_rating:   2 * P_dissipated,    // 2× margin for continuous safe operation
      C_value:          C,
      C_voltage_rating: 1.25 * V_clamp,      // 25 % derating per capacitor standard practice
      diode_Vr,
    },
  }
}
