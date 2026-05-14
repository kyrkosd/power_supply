import type { DesignSpec, DesignResult } from '../types'
import type { CurrentSenseResult } from './types'
import { slopeCompRamp, VNOISE_FLOOR_V, RDSON_TC_PCT_PER_C, RDSON_NOMINAL, RDSON_EVAL_TEMP_C } from './common'

// Temperature drift: ΔRds(on) ≈ TC × ΔT — Infineon AN_1805
export function designRdsonSense(
  spec: DesignSpec,
  result: DesignResult,
  deltaIL: number,
  iL_peak_light: number,
  warnings: string[],
): CurrentSenseResult {
  const rdson_temp_error_pct = (RDSON_EVAL_TEMP_C - 25) * RDSON_TC_PCT_PER_C
  const vsense_peak          = result.peakCurrent * RDSON_NOMINAL
  const vsense_valley        = Math.max(result.peakCurrent - deltaIL, 0) * RDSON_NOMINAL
  const snr_rdson            = 20 * Math.log10(Math.max(iL_peak_light * RDSON_NOMINAL / VNOISE_FLOOR_V, 1))

  if (rdson_temp_error_pct > 20)
    warnings.push(
      `Rds(on) sensing has ${rdson_temp_error_pct.toFixed(0)} % accuracy variation across ` +
      `temperature (25–${RDSON_EVAL_TEMP_C} °C). Use a dedicated sense resistor for tight current limiting.`,
    )
  if (result.dutyCycle > 0.5)
    warnings.push(`Duty cycle > 50 %: slope compensation is required to prevent subharmonic oscillation.`)

  return {
    method: 'rdson', rsense: 0, rsense_power: 0, rsense_package: 'N/A',
    vsense_peak, vsense_valley, snr_at_light_load: snr_rdson,
    kelvin_connection_required: false, rdson_temp_error_pct,
    slope_comp_ramp: slopeCompRamp(spec.vout, result.inductance, RDSON_NOMINAL), warnings,
  }
}
