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
  rsense: number                    // Ω   — 0 for rdson
  rsense_power: number              // W   — I²_rms × Rsense (0 for rdson)
  rsense_package: string            // recommended package (0805, 1206, 2010, 2512, shunt)
  vsense_peak: number               // V   — peak voltage across sense element
  vsense_valley: number             // V   — valley voltage
  snr_at_light_load: number         // dB  — at 10 % Iout vs 5 mV noise floor
  kelvin_connection_required: boolean  // true when Rsense < 10 mΩ
  rdson_temp_error_pct: number      // %   — 0 for resistor; accuracy drift at 100 °C
  slope_comp_ramp: number           // V/s — minimum external ramp to avoid subharmonics
  warnings: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// RMS of a triangular waveform with DC component Iavg and peak-to-peak ripple ΔiL.
// Erickson & Maksimovic eq. 1.7: IL_rms = sqrt(Iavg² + ΔiL²/12)
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

// ── Constants ─────────────────────────────────────────────────────────────────

// Typical sense IC noise floor (LM5141, TPS543x class); worse-case = 5 mV.
const VNOISE_FLOOR_V = 0.005

// Silicon MOSFET Rds(on) temperature coefficient — Infineon AN_1805.
const RDSON_TC_PCT_PER_C = 0.40   // %/°C above 25 °C

// Assumed Rds(on) when no MOSFET is selected yet (conservative 20 mΩ).
const RDSON_NOMINAL = 0.020       // Ω

// Tj at which rdson error is evaluated.
const RDSON_EVAL_TEMP_C = 100     // °C

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Size the current sense element for peak current-mode control.
 *
 * @param topology   - topology ID string (used for future multi-topology support)
 * @param spec       - design spec (uses vinMin, vout, iout, fsw, controlMode)
 * @param result     - computed design result (uses peakCurrent, inductance, dutyCycle)
 * @param method     - 'resistor' or 'rdson'
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

  // ΔiL = 2 × (IL_peak − IL_avg)
  // peakCurrent from the engine is the absolute peak; Iout is the average.
  const deltaIL    = 2 * Math.max(result.peakCurrent - spec.iout, 0)
  const ilRmsValue = triangularRms(spec.iout, deltaIL)
  const L          = result.inductance

  // Slope compensation ramp magnitude.
  // Required: Se ≥ 0.5 × m₂ where m₂ is the sensed falling slope in V/s.
  // m₂ = Vout × Rsense / L  (for a buck converter)
  // Reference: TI SLVA101 eq. 4
  const computeSlopeCompRamp = (rsense: number): number =>
    0.5 * (spec.vout / L) * rsense

  // Peak current at 10 % load (ΔiL unchanged in CCM — ripple is load-independent).
  const iL_peak_light = Math.max(0.1 * spec.iout + deltaIL / 2, 1e-6)

  if (method === 'resistor') {
    // ── Rsense = Vsense_target / IL_peak  (TI SLVA452B eq. 1) ────────────────
    const vsense_target = vsenseTargetMv / 1000
    const rsense        = vsense_target / result.peakCurrent

    const rsense_power   = ilRmsValue * ilRmsValue * rsense
    const rsense_package = packageForPower(rsense_power)
    const vsense_peak    = result.peakCurrent * rsense
    const vsense_valley  = Math.max(result.peakCurrent - deltaIL, 0) * rsense

    // SNR at 10 % load: signal = light-load peak sense voltage vs 5 mV noise floor
    const vsense_light  = iL_peak_light * rsense
    const snr           = 20 * Math.log10(Math.max(vsense_light / VNOISE_FLOOR_V, 1))

    // Kelvin (4-wire) connection required when Rsense < 10 mΩ (Vishay VYMC).
    const kelvin = rsense < 0.010

    const slope_comp_ramp = computeSlopeCompRamp(rsense)

    // Warnings
    if (vsenseTargetMv < 50) {
      warnings.push(
        `Target Vsense ${vsenseTargetMv} mV is very low — noise immunity will be poor. Recommend ≥ 100 mV.`,
      )
    }
    if (vsenseTargetMv > 300) {
      warnings.push(
        `Target Vsense ${vsenseTargetMv} mV is high — Rsense dissipation increases. Typical: 100–200 mV.`,
      )
    }
    if (rsense_power > 0.5) {
      warnings.push(
        `Rsense dissipates ${(rsense_power * 1000).toFixed(0)} mW. Consider lower Vsense target or larger package.`,
      )
    }
    if (snr < 14) {
      warnings.push(
        `SNR at 10 % load is only ${snr.toFixed(0)} dB — current limiting accuracy at light load will be poor.`,
      )
    }
    if (kelvin) {
      warnings.push(
        `Rsense = ${(rsense * 1000).toFixed(1)} mΩ: use Kelvin (4-wire) PCB connections to exclude trace resistance error.`,
      )
    }
    if (result.dutyCycle > 0.5) {
      warnings.push(
        `Duty cycle > 50 %: slope compensation is required to prevent subharmonic oscillation (TI SLVA101).`,
      )
    }

    return {
      method: 'resistor',
      rsense,
      rsense_power,
      rsense_package,
      vsense_peak,
      vsense_valley,
      snr_at_light_load: snr,
      kelvin_connection_required: kelvin,
      rdson_temp_error_pct: 0,
      slope_comp_ramp,
      warnings,
    }
  }

  // ── Rds(on) method ────────────────────────────────────────────────────────
  // No external resistor. Vds across Q1 during on-time = IL × Rds(on).
  // Temperature coefficient: ≈ +0.4 %/°C for silicon — Infineon AN_1805.
  const rdson_temp_error_pct = (RDSON_EVAL_TEMP_C - 25) * RDSON_TC_PCT_PER_C  // 30 %

  const vsense_peak   = result.peakCurrent * RDSON_NOMINAL
  const vsense_valley = Math.max(result.peakCurrent - deltaIL, 0) * RDSON_NOMINAL

  const vsense_light_rdson = iL_peak_light * RDSON_NOMINAL
  const snr_rdson = 20 * Math.log10(Math.max(vsense_light_rdson / VNOISE_FLOOR_V, 1))

  const slope_comp_ramp = computeSlopeCompRamp(RDSON_NOMINAL)

  if (rdson_temp_error_pct > 20) {
    warnings.push(
      `Rds(on) sensing has ${rdson_temp_error_pct.toFixed(0)} % accuracy variation across temperature (25–${RDSON_EVAL_TEMP_C} °C). Use a dedicated sense resistor for tight current limiting.`,
    )
  }
  if (result.dutyCycle > 0.5) {
    warnings.push(`Duty cycle > 50 %: slope compensation is required to prevent subharmonic oscillation.`)
  }

  return {
    method: 'rdson',
    rsense: 0,
    rsense_power: 0,
    rsense_package: 'N/A',
    vsense_peak,
    vsense_valley,
    snr_at_light_load: snr_rdson,
    kelvin_connection_required: false,
    rdson_temp_error_pct,
    slope_comp_ramp,
    warnings,
  }
}
