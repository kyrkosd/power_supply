// Current sense element design for peak current-mode control (PCM).
//
// References:
//   TI SLVA452B  — Current-Sensing Techniques in Buck Converters
//   TI SLVA101   — Slope Compensation / Current-Mode Stability
//   Ridley Engineering, "A New Small-Signal Model for Current-Mode Control" (1991)
//   Infineon AN_1805_PL52_1803_132890 — Rds(on) sensing accuracy vs. temperature
//   Vishay VYMC  — Kelvin sensing requirements for low-value current-sense resistors

import type { DesignSpec, DesignResult } from './types'

// ── Public types ──────────────────────────────────────────────────────────────

export type SenseMethod = 'resistor' | 'rdson'

export interface CurrentSenseResult {
  method: SenseMethod
  rsense: number                       // Ω   — 0 for rdson
  rsense_power: number                 // W   — I²_rms × Rsense (0 for rdson)
  rsense_package: string               // recommended package (0805, 1206, 2010, 2512, shunt)
  vsense_peak: number                  // V   — peak voltage across sense element
  vsense_valley: number                // V   — valley voltage
  snr_at_light_load: number            // dB  — at 10 % Iout vs 5 mV noise floor
  kelvin_connection_required: boolean  // true when Rsense < 10 mΩ
  rdson_temp_error_pct: number         // %   — 0 for resistor; accuracy drift at 100 °C
  slope_comp_ramp: number              // V/s — minimum external ramp to avoid subharmonics
  warnings: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// RMS of a triangular waveform — Erickson & Maksimovic eq. 1.7: IL_rms = sqrt(Iavg² + ΔiL²/12)
function triangularRms(iavg: number, deltaIL: number): number {
  return Math.sqrt(iavg * iavg + (deltaIL * deltaIL) / 12)
}

function packageForPower(powerW: number): string {
  if (powerW < 0.125) return '0805'
  if (powerW < 0.25)  return '1206'
  if (powerW < 0.5)   return '2010'
  if (powerW < 1.0)   return '2512'
  return '4-terminal shunt (Kelvin)'
}

// TI SLVA101 eq. 4: Se ≥ 0.5 × m₂, m₂ = Vout × Rsense / L (buck converter)
function slopeCompRamp(vout: number, L: number, rsense: number): number {
  return 0.5 * (vout / L) * rsense
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VNOISE_FLOOR_V      = 0.005  // V   — typical PCM sense IC noise floor (LM5141 class)
const RDSON_TC_PCT_PER_C  = 0.40   // %/°C — silicon Rds(on) temp coefficient (Infineon AN_1805)
const RDSON_NOMINAL       = 0.020  // Ω   — assumed Rds(on) when no MOSFET selected
const RDSON_EVAL_TEMP_C   = 100    // °C  — temperature at which rdson error is evaluated

// ── Branch handlers ───────────────────────────────────────────────────────────

function designResistorSense(
  spec: DesignSpec,
  result: DesignResult,
  deltaIL: number,
  ilRmsValue: number,
  iL_peak_light: number,
  vsenseTargetMv: number,
  warnings: string[],
): CurrentSenseResult {
  // TI SLVA452B eq. 1: Rsense = Vsense_target / IL_peak
  const rsense         = (vsenseTargetMv / 1000) / result.peakCurrent
  const rsense_power   = ilRmsValue * ilRmsValue * rsense
  const rsense_package = packageForPower(rsense_power)
  const vsense_peak    = result.peakCurrent * rsense
  const vsense_valley  = Math.max(result.peakCurrent - deltaIL, 0) * rsense
  const snr            = 20 * Math.log10(Math.max(iL_peak_light * rsense / VNOISE_FLOOR_V, 1))
  const kelvin         = rsense < 0.010  // Vishay VYMC

  if (vsenseTargetMv < 50)
    warnings.push(`Target Vsense ${vsenseTargetMv} mV is very low — noise immunity will be poor. Recommend ≥ 100 mV.`)
  if (vsenseTargetMv > 300)
    warnings.push(`Target Vsense ${vsenseTargetMv} mV is high — Rsense dissipation increases. Typical: 100–200 mV.`)
  if (rsense_power > 0.5)
    warnings.push(`Rsense dissipates ${(rsense_power * 1000).toFixed(0)} mW. Consider lower Vsense target or larger package.`)
  if (snr < 14)
    warnings.push(`SNR at 10 % load is only ${snr.toFixed(0)} dB — current limiting accuracy at light load will be poor.`)
  if (kelvin)
    warnings.push(`Rsense = ${(rsense * 1000).toFixed(1)} mΩ: use Kelvin (4-wire) PCB connections to exclude trace resistance error.`)
  if (result.dutyCycle > 0.5)
    warnings.push(`Duty cycle > 50 %: slope compensation is required to prevent subharmonic oscillation (TI SLVA101).`)

  return {
    method: 'resistor', rsense, rsense_power, rsense_package,
    vsense_peak, vsense_valley, snr_at_light_load: snr,
    kelvin_connection_required: kelvin, rdson_temp_error_pct: 0,
    slope_comp_ramp: slopeCompRamp(spec.vout, result.inductance, rsense), warnings,
  }
}

function designRdsonSense(
  spec: DesignSpec,
  result: DesignResult,
  deltaIL: number,
  iL_peak_light: number,
  warnings: string[],
): CurrentSenseResult {
  // Temperature drift: ΔRds(on) ≈ TC × ΔT — Infineon AN_1805
  const rdson_temp_error_pct = (RDSON_EVAL_TEMP_C - 25) * RDSON_TC_PCT_PER_C  // 30 %
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

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Size the current sense element for peak current-mode control.
 *
 * @param _topology      - topology ID (reserved for future multi-topology support)
 * @param spec           - design spec (vinMin, vout, iout, fsw, controlMode)
 * @param result         - design result (peakCurrent, inductance, dutyCycle)
 * @param method         - 'resistor' or 'rdson'
 * @param vsenseTargetMv - desired peak sense voltage for resistor method (default 150 mV)
 */
export function designCurrentSense(
  _topology: string,
  spec: DesignSpec,
  result: DesignResult,
  method: SenseMethod,
  vsenseTargetMv = 150,
): CurrentSenseResult {
  const warnings: string[] = []
  // ΔiL = 2 × (IL_peak − IL_avg); peakCurrent is absolute peak, Iout is average
  const deltaIL       = 2 * Math.max(result.peakCurrent - spec.iout, 0)
  const ilRmsValue    = triangularRms(spec.iout, deltaIL)
  const iL_peak_light = Math.max(0.1 * spec.iout + deltaIL / 2, 1e-6)

  return method === 'resistor'
    ? designResistorSense(spec, result, deltaIL, ilRmsValue, iL_peak_light, vsenseTargetMv, warnings)
    : designRdsonSense(spec, result, deltaIL, iL_peak_light, warnings)
}
