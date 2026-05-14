import type { DesignSpec, DesignResult } from '../types'

export interface MiddlebrookResult {
  negative_input_impedance:             number
  filter_output_impedance_at_resonance: number
  stability_margin_db:                  number
  middlebrook_stable:                   boolean
}

// Middlebrook stability criterion.
// |Zin| = Vin² / (Pout / η)  (Middlebrook IEEE IAS 1976 eq. 3).
// Stability: |Zout_peak| < |Zin| / 3  (tightened criterion, Erickson §10.3).
export function computeMiddlebrook(
  spec: DesignSpec,
  result: DesignResult,
  damping_resistor: number,
): MiddlebrookResult {
  const pout = spec.vout * spec.iout
  const eff  = result.efficiency ?? spec.efficiency
  const negative_input_impedance             = spec.vinMin ** 2 / (pout / eff)
  const filter_output_impedance_at_resonance = damping_resistor
  const stability_margin_db = 20 * Math.log10(
    negative_input_impedance / (3 * filter_output_impedance_at_resonance),
  )
  const middlebrook_stable =
    (filter_output_impedance_at_resonance / negative_input_impedance) < 1 / 3
  return { negative_input_impedance, filter_output_impedance_at_resonance, stability_margin_db, middlebrook_stable }
}
