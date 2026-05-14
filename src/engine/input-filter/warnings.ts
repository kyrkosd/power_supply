import type { DesignSpec } from '../types'
import type { InputFilterOptions } from './types'
import type { EMIResult } from '../topologies/types'
import { fmtR, fmtH } from './format'

export function resolveAttenuationTarget(opts: InputFilterOptions, emi: EMIResult): number {
  if (opts.attenuation_override_db > 0) return opts.attenuation_override_db
  if (emi.worst_margin_db < 0) return Math.abs(emi.worst_margin_db) + 6
  return Math.max(20, 6 - emi.worst_margin_db)
}

export function buildFilterWarnings(
  spec: DesignSpec,
  filter_resonant_freq: number,
  filter_attenuation_at_fsw: number,
  required_attenuation_db: number,
  middlebrook_stable: boolean,
  stability_margin_db: number,
  filter_output_impedance_at_resonance: number,
  negative_input_impedance: number,
  cm_choke: number,
  was_clamped: boolean,
): string[] {
  const warnings: string[] = []

  if (filter_attenuation_at_fsw < required_attenuation_db)
    warnings.push(
      `Filter provides ${filter_attenuation_at_fsw.toFixed(0)} dB at fsw but ${required_attenuation_db.toFixed(0)} dB is required. ` +
      `Reduce f_res (increase L and C) or add a second filter stage.`,
    )

  if (!middlebrook_stable)
    warnings.push(
      `Middlebrook stability criterion violated: filter output impedance (${fmtR(filter_output_impedance_at_resonance)}) ` +
      `≥ Zin/3 (${fmtR(negative_input_impedance / 3)}). ` +
      `Increase damping resistor or reduce filter inductance.`,
    )
  else if (stability_margin_db < 6)
    warnings.push(
      `Middlebrook margin is only ${stability_margin_db.toFixed(1)} dB. Recommend > 6 dB. ` +
      `Consider larger Rd or a lower filter inductance.`,
    )

  if (filter_resonant_freq < 500)
    warnings.push(
      `Filter resonance at ${filter_resonant_freq.toFixed(0)} Hz is close to line frequency. ` +
      `Reduce filter component values.`,
    )

  if (was_clamped)
    warnings.push(`CM choke clamped to ${fmtH(cm_choke)} (practical range 1–47 mH).`)

  if (spec.vinMax > 500)
    warnings.push(
      `Vin_max = ${spec.vinMax} V exceeds typical X2 capacitor ratings (275 Vrms / 400 Vdc). ` +
      `Use X1 class capacitors (440 Vrms) for 277 Vrms mains.`,
    )

  return warnings
}
