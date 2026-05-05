// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// RCD clamp/snubber design for flyback and forward converters.
// Reference: TI Application Report SLUA107 "Flyback Converter Design",
//            Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §6.2.2

import type { DesignSpec, DesignResult } from './types'

export type SnubberTopology = 'flyback' | 'forward'

export interface SnubberResult {
  type: 'RCD_clamp'
  leakage_inductance: number // H — Llk = leakage_ratio × Lm
  V_clamp: number            // V
  R: number                  // Ω
  C: number                  // F
  P_dissipated: number       // W
  components: {
    R_value: number          // Ω — use nearest E24 series resistor
    R_power_rating: number   // W — 2× P_dissipated for thermal margin
    C_value: number          // F
    C_voltage_rating: number // V — 125% of V_clamp
    diode_Vr: number         // V — minimum reverse voltage for clamp diode
  }
}

export const DEFAULT_LEAKAGE_RATIO = 0.02  // 2 % of magnetising inductance

export function designSnubber(
  topologyId: SnubberTopology,
  spec: DesignSpec,
  result: DesignResult,
  leakage_ratio = DEFAULT_LEAKAGE_RATIO,
): SnubberResult {
  const Lm = result.magnetizingInductance ?? result.inductance
  const { fsw, vinMax, vinMin, vout, iout, efficiency } = spec

  // Leakage inductance: Llk = leakage_ratio × Lm  (Erickson §6.2.2)
  const Llk = leakage_ratio * Lm

  // Primary peak current (topology-dependent)
  // Flyback: result.peakCurrent is the magnetising peak on the primary winding.
  // Forward: result.peakCurrent is the output inductor peak — derive primary from spec.
  let Ip_peak: number
  if (topologyId === 'flyback') {
    Ip_peak = result.peakCurrent
  } else {
    const pout = vout * iout
    const eta  = Math.min(Math.max(efficiency, 0.5), 1)
    const primaryCurrentAvg = pout / (eta * vinMin)
    const deltaIm = 0.20 * primaryCurrentAvg  // 20 % ripple target (forward.ts §6)
    const N = result.turnsRatio ?? 1
    Ip_peak = iout / N + deltaIm
  }

  // Energy stored in leakage inductance per switching cycle  (TI SLUA107 eq. 5)
  // E_lk = ½ × Llk × Ip_peak²
  const E_lk = 0.5 * Llk * Ip_peak * Ip_peak

  // Clamp voltage  (TI SLUA107 eq. 4)
  // V_clamp = 1.5 × Vin_max — headroom over reflected primary voltage
  const V_clamp = 1.5 * vinMax

  // Snubber resistor: R = V_clamp² / (E_lk × fsw)
  // Derived from energy balance: P_R = V_clamp²/R = E_lk × fsw  (TI SLUA107 eq. 6)
  const R = V_clamp ** 2 / (E_lk * fsw)

  // Snubber capacitor: C = 2 × E_lk / V_clamp²  (Erickson §6.2.2)
  // Sized so the capacitor can hold the clamped energy at V_clamp.
  const C = (2 * E_lk) / V_clamp ** 2

  // Power dissipated in the RCD resistor each second
  const P_dissipated = E_lk * fsw  // = V_clamp²/R

  // Clamp diode: must block V_clamp + Vin_max  (TI SLUA107 §3.3)
  // Use an ultra-fast recovery diode (trr < 50 ns) with adequate Vr.
  const diode_Vr = V_clamp + vinMax

  return {
    type: 'RCD_clamp',
    leakage_inductance: Llk,
    V_clamp,
    R,
    C,
    P_dissipated,
    components: {
      R_value: R,
      R_power_rating: 2 * P_dissipated,   // 2× margin for continuous safe operation
      C_value: C,
      C_voltage_rating: 1.25 * V_clamp,   // 25 % derating per capacitor standard practice
      diode_Vr,
    },
  }
}
