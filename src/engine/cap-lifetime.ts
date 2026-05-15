// Electrolytic capacitor lifetime estimation using the Arrhenius acceleration model.
// References:
//   - Nichicon General Specification UPS3 (2022) — thermal acceleration factor
//   - Vishay BCcomponents AN0012 — voltage derating and lifetime
//   - Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §13.1
//   - IEC 61709:2017 — Electric components reliability, reference conditions and stress models

const RTH_CAP_DEFAULT = 20  // °C/W — default cap-to-ambient thermal resistance (Nichicon AN)

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
  irms_actual: number    // A  — actual RMS ripple current through the capacitor
  vdc: number            // V  — DC voltage across the capacitor (≈ Vout)
  ambient_temp_C: number
  rth_cap?: number       // °C/W — thermal resistance cap-to-ambient; default 20 °C/W
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Self-heating from ripple current dissipated in ESR — IEC 61709 §6.1. */
function computeSelfHeating(irms_actual: number, esr_ohm: number, rth: number): number {
  return irms_actual * irms_actual * esr_ohm * rth
}

/**
 * Arrhenius thermal acceleration factor.
 * L = L_base × 2^((T_rated − T_actual) / 10) — Nichicon UPS3 eq. (1).
 */
function computeArrheniusLifetime(L_base: number, T_rated: number, operating_temp: number): number {
  return L_base * Math.pow(2, (T_rated - operating_temp) / 10)
}

/**
 * Voltage derating — Vishay BCcomponents AN0012.
 * Accelerated aging above 80 % rated voltage: factor = (Vrated / Vdc)³.
 */
function applyVoltageDerating(L_derated: number, vdc: number, Vrated: number): number {
  if (vdc / Vrated > 0.8) return L_derated * Math.pow(Vrated / vdc, 3)
  return L_derated
}

/** Collect lifetime warnings. */
function buildLifetimeWarnings(
  ripple_current_ratio: number,
  voltage_stress_ratio: number,
  derated_lifetime_years: number,
): string[] {
  const warnings: string[] = []
  if (ripple_current_ratio > 0.8)
    warnings.push('Capacitor operating near ripple current limit. Self-heating will reduce lifetime.')
  if (voltage_stress_ratio > 0.8)
    warnings.push('Derate by choosing a higher voltage rating for improved reliability.')
  if (derated_lifetime_years < 2)
    warnings.push('Capacitor lifetime critically short. Use a polymer or ceramic alternative.')
  else if (derated_lifetime_years < 5)
    warnings.push('Consider a higher-temperature-rated capacitor or reduce ripple current.')
  return warnings
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Called by: ComponentSuggestions component — directly on the renderer thread when the selected
// capacitor type is 'electrolytic'. Ceramic capacitors skip this call and show "N/A". The
// function is a pure arithmetic model (Arrhenius + ripple self-heating), so it needs no worker.
export function estimateLifetime(
  cap: CapacitorDataForLifetime,
  conditions: CapOperatingConditions,
): CapLifetimeResult {
  const L_base    = cap.lifetime_hours ?? 2000
  const T_rated   = cap.temp_rating   ?? 105
  const esr_ohm   = cap.esr_mohm / 1000
  const rth       = conditions.rth_cap ?? RTH_CAP_DEFAULT
  const { irms_actual, vdc, ambient_temp_C } = conditions

  const self_heating_C  = computeSelfHeating(irms_actual, esr_ohm, rth)
  const operating_temp  = ambient_temp_C + self_heating_C

  let L_derated = computeArrheniusLifetime(L_base, T_rated, operating_temp)
  L_derated     = applyVoltageDerating(L_derated, vdc, cap.voltage_v)
  L_derated     = Math.max(L_derated, 0)

  const derated_lifetime_years = L_derated / 8760
  const ripple_current_ratio   = cap.ripple_current_a > 0 ? irms_actual / cap.ripple_current_a : 0
  const voltage_stress_ratio   = vdc / cap.voltage_v

  return {
    base_lifetime_hours:    L_base,
    temp_rated:             T_rated,
    operating_temp,
    self_heating_C,
    derated_lifetime_hours: L_derated,
    derated_lifetime_years,
    ripple_current_ratio,
    voltage_stress_ratio,
    warnings: buildLifetimeWarnings(ripple_current_ratio, voltage_stress_ratio, derated_lifetime_years),
  }
}
