// Electrolytic capacitor lifetime estimation using the Arrhenius acceleration model.
// References:
//   - Nichicon General Specification UPS3 (2022) — thermal acceleration factor
//   - Vishay BCcomponents AN0012 — voltage derating and lifetime
//   - Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §13.1
//   - IEC 61709:2017 — Electric components reliability, reference conditions and stress models

// Default thermal resistance capacitor-to-ambient (°C/W), per Nichicon AN.
const RTH_CAP_DEFAULT = 20

export interface CapacitorDataForLifetime {
  esr_mohm: number          // mΩ — equivalent series resistance at rated frequency
  ripple_current_a: number  // A  — rated ripple current at 100 kHz
  voltage_v: number         // V  — rated DC voltage
  type: string              // 'electrolytic' | 'ceramic' | ...
  lifetime_hours?: number   // h  — base lifetime from datasheet (default 2000 h)
  temp_rating?: number      // °C — maximum rated temperature (default 105 °C)
}

export interface CapLifetimeResult {
  base_lifetime_hours: number   // h   — datasheet base value at T_rated
  temp_rated: number            // °C  — capacitor maximum rated temperature
  operating_temp: number        // °C  — T_ambient + ΔT_self_heating
  self_heating_C: number        // °C  — temperature rise from ripple current
  derated_lifetime_hours: number
  derated_lifetime_years: number
  ripple_current_ratio: number  // —   — actual / rated (>1 means overloaded)
  voltage_stress_ratio: number  // —   — Vdc / Vrated (>0.8 triggers voltage derating)
  warnings: string[]
}

export interface CapOperatingConditions {
  irms_actual: number   // A  — actual RMS ripple current through the capacitor
  vdc: number           // V  — DC voltage across the capacitor (≈ Vout)
  ambient_temp_C: number
  rth_cap?: number      // °C/W — thermal resistance cap-to-ambient; default 20 °C/W
}

export function estimateLifetime(
  cap: CapacitorDataForLifetime,
  conditions: CapOperatingConditions,
): CapLifetimeResult {
  const L_base   = cap.lifetime_hours ?? 2000
  const T_rated  = cap.temp_rating   ?? 105
  const Irms_rated = cap.ripple_current_a
  const Vrated   = cap.voltage_v
  const esr_ohm  = cap.esr_mohm / 1000
  const rth      = conditions.rth_cap ?? RTH_CAP_DEFAULT

  const { irms_actual, vdc, ambient_temp_C } = conditions

  // ── Self-heating from ripple current ────────────────────────────────────────
  // IEC 61709 §6.1 — power dissipated in ESR: P = Irms² × ESR
  const self_heating_C = irms_actual * irms_actual * esr_ohm * rth

  const operating_temp = ambient_temp_C + self_heating_C

  // ── Arrhenius thermal acceleration factor ────────────────────────────────────
  // L_actual = L_base × 2^((T_rated − T_actual) / 10)
  // Nichicon General Specification UPS3, eq. (1)
  const exponent = (T_rated - operating_temp) / 10
  let L_derated = L_base * Math.pow(2, exponent)

  // ── Voltage derating factor ──────────────────────────────────────────────────
  // Vishay BCcomponents AN0012 — accelerated aging above 80 % rated voltage:
  //   factor = (Vrated / Vdc)³
  const voltage_stress_ratio = vdc / Vrated
  if (voltage_stress_ratio > 0.8) {
    const voltage_factor = Math.pow(Vrated / vdc, 3)
    L_derated *= voltage_factor
  }

  // Clamp to a physically sensible minimum (wear-out still happens at low temp)
  L_derated = Math.max(L_derated, 0)

  const derated_lifetime_years = L_derated / 8760

  const ripple_current_ratio = Irms_rated > 0 ? irms_actual / Irms_rated : 0

  const warnings: string[] = []

  if (ripple_current_ratio > 0.8) {
    warnings.push(
      'Capacitor operating near ripple current limit. Self-heating will reduce lifetime.'
    )
  }

  if (voltage_stress_ratio > 0.8) {
    warnings.push(
      'Derate by choosing a higher voltage rating for improved reliability.'
    )
  }

  if (derated_lifetime_years < 2) {
    warnings.push(
      'Capacitor lifetime critically short. Use a polymer or ceramic alternative.'
    )
  } else if (derated_lifetime_years < 5) {
    warnings.push(
      'Consider a higher-temperature-rated capacitor or reduce ripple current.'
    )
  }

  return {
    base_lifetime_hours: L_base,
    temp_rated: T_rated,
    operating_temp,
    self_heating_C,
    derated_lifetime_hours: L_derated,
    derated_lifetime_years,
    ripple_current_ratio,
    voltage_stress_ratio,
    warnings,
  }
}
