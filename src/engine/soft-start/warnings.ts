import type { DesignSpec } from '../types'
import { ISOLATED_TOPOLOGIES } from './tss'

export function buildSoftStartWarnings(
  spec: DesignSpec,
  topology: string,
  tss_used: number,
  dcr_known: boolean,
  dcr_ohm: number,
  peak_inrush_a: number,
  output_monotonic: boolean,
  fc_est: number,
): string[] {
  const warnings: string[] = []

  if (!dcr_known)
    warnings.push(
      `DCR estimated (~${(dcr_ohm * 1e3).toFixed(0)} mΩ) — select an inductor for accurate inrush estimation.`,
    )

  if (peak_inrush_a > 10 * spec.iout)
    warnings.push(
      `Peak inrush without soft-start (${peak_inrush_a.toFixed(0)} A) is more than ` +
      `10× rated current. Consider an NTC thermistor or pre-charge circuit.`,
    )

  if (!output_monotonic)
    warnings.push(
      `Startup may not be monotonic: estimated loop bandwidth (~${(fc_est / 1000).toFixed(0)} kHz) ` +
      `is below the soft-start ramp rate (${(1 / tss_used).toFixed(0)} Hz). ` +
      `Increase tss or verify loop gain.`,
    )

  if (ISOLATED_TOPOLOGIES.has(topology))
    warnings.push(
      `Pre-biased startup for isolated topologies requires secondary-side detection ` +
      `(TL431 output-voltage sensing). Basic primary-side soft-start is insufficient.`,
    )

  return warnings
}
