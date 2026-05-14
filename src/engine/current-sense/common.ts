// Erickson & Maksimovic eq. 1.7: IL_rms = sqrt(Iavg² + ΔiL²/12)
export function triangularRms(iavg: number, deltaIL: number): number {
  return Math.sqrt(iavg * iavg + (deltaIL * deltaIL) / 12)
}

export function packageForPower(powerW: number): string {
  if (powerW < 0.125) return '0805'
  if (powerW < 0.25)  return '1206'
  if (powerW < 0.5)   return '2010'
  if (powerW < 1.0)   return '2512'
  return '4-terminal shunt (Kelvin)'
}

// TI SLVA101 eq. 4: Se ≥ 0.5 × m₂, m₂ = Vout × Rsense / L (buck converter)
export function slopeCompRamp(vout: number, L: number, rsense: number): number {
  return 0.5 * (vout / L) * rsense
}

export const VNOISE_FLOOR_V     = 0.005  // V   — typical PCM sense IC noise floor
export const RDSON_TC_PCT_PER_C = 0.40   // %/°C — silicon Rds(on) temp coefficient
export const RDSON_NOMINAL      = 0.020  // Ω   — assumed Rds(on) when no MOSFET selected
export const RDSON_EVAL_TEMP_C  = 100    // °C  — temperature at which rdson error is evaluated
