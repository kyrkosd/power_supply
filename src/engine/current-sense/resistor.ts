import type { DesignSpec, DesignResult } from '../types'
import type { CurrentSenseResult } from './types'
import { packageForPower, slopeCompRamp, VNOISE_FLOOR_V } from './common'

function vsenseWarnings(vsenseTargetMv: number, rsense_power: number, _: number): string[] {
  const warns: string[] = []
  if (vsenseTargetMv < 50)   warns.push(`Target Vsense ${vsenseTargetMv} mV is very low — noise immunity will be poor. Recommend ≥ 100 mV.`)
  if (vsenseTargetMv > 300)  warns.push(`Target Vsense ${vsenseTargetMv} mV is high — Rsense dissipation increases. Typical: 100–200 mV.`)
  if (rsense_power > 0.5)    warns.push(`Rsense dissipates ${(rsense_power * 1000).toFixed(0)} mW. Consider lower Vsense target or larger package.`)
  return warns
}

function circuitWarnings(snr: number, kelvin: boolean, rsense: number, dutyCycle: number): string[] {
  const warns: string[] = []
  if (snr < 14)       warns.push(`SNR at 10 % load is only ${snr.toFixed(0)} dB — current limiting accuracy at light load will be poor.`)
  if (kelvin)         warns.push(`Rsense = ${(rsense * 1000).toFixed(1)} mΩ: use Kelvin (4-wire) PCB connections to exclude trace resistance error.`)
  if (dutyCycle > 0.5) warns.push(`Duty cycle > 50 %: slope compensation is required to prevent subharmonic oscillation (TI SLVA101).`)
  return warns
}

// TI SLVA452B eq. 1: Rsense = Vsense_target / IL_peak
export function designResistorSense(
  spec: DesignSpec,
  result: DesignResult,
  deltaIL: number,
  ilRmsValue: number,
  iL_peak_light: number,
  vsenseTargetMv: number,
  warnings: string[],
): CurrentSenseResult {
  const rsense         = (vsenseTargetMv / 1000) / result.peakCurrent
  const rsense_power   = ilRmsValue * ilRmsValue * rsense
  const rsense_package = packageForPower(rsense_power)
  const vsense_peak    = result.peakCurrent * rsense
  const vsense_valley  = Math.max(result.peakCurrent - deltaIL, 0) * rsense
  const snr            = 20 * Math.log10(Math.max(iL_peak_light * rsense / VNOISE_FLOOR_V, 1))
  const kelvin         = rsense < 0.010  // Vishay VYMC

  warnings.push(...vsenseWarnings(vsenseTargetMv, rsense_power, rsense))
  warnings.push(...circuitWarnings(snr, kelvin, rsense, result.dutyCycle))

  return {
    method: 'resistor', rsense, rsense_power, rsense_package,
    vsense_peak, vsense_valley, snr_at_light_load: snr,
    kelvin_connection_required: kelvin, rdson_temp_error_pct: 0,
    slope_comp_ramp: slopeCompRamp(spec.vout, result.inductance, rsense), warnings,
  }
}
