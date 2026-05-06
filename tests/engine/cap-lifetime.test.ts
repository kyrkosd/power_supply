// Cap lifetime tests — reference: Nichicon General Specification UPS3 (2022)
// Hand-calculated values for a Panasonic 100 µF / 25 V electrolytic at typical conditions.
//
// Test case A (nominal):
//   L_base = 2000 h, T_rated = 105 °C, ambient = 40 °C
//   Irms_actual = 0.5 A, Irms_rated = 1.5 A, ESR = 25 mΩ, Rth = 20 °C/W
//   ΔT = 0.5² × 0.025 × 20 = 0.125 °C  → T_op = 40.125 °C
//   exponent = (105 − 40.125) / 10 = 6.4875
//   L = 2000 × 2^6.4875 = 179 457.7 h → 20.49 yr
//   Vdc/Vrated = 12/25 = 0.48  → no voltage derating
//
// Test case B (hot + high current):
//   L_base = 2000 h, T_rated = 105 °C, ambient = 85 °C
//   Irms_actual = 1.2 A, Irms_rated = 1.5 A, ESR = 25 mΩ, Rth = 20 °C/W
//   ΔT = 1.2² × 0.025 × 20 = 0.72 °C  → T_op = 85.72 °C
//   exponent = (105 − 85.72) / 10 = 1.928
//   L = 2000 × 2^1.928 = 7 610.5 h → 0.869 yr  (< 2 yr → critical warning)
//
// Test case C (voltage derating triggered):
//   Same Arrhenius base as test A (179 457.7 h) but vdc=22 V, Vrated=25 V → ratio = 0.88 (> 0.8)
//   voltage_factor = (25/22)^3 ≈ 1.4645
//   L_derated = 179 457.7 × 1.4645 ≈ 262 810 h → ≈ 30.0 yr

import { describe, it, expect } from 'vitest'
import { estimateLifetime } from '../../src/engine/cap-lifetime'

const BASE_CAP = {
  esr_mohm: 25,
  ripple_current_a: 1.5,
  voltage_v: 25,
  type: 'electrolytic',
  lifetime_hours: 2000,
  temp_rating: 105,
}

describe('estimateLifetime', () => {
  it('test A — nominal operating conditions, no derating', () => {
    const result = estimateLifetime(BASE_CAP, {
      irms_actual: 0.5,
      vdc: 12,
      ambient_temp_C: 40,
    })

    // Self-heating: 0.5² × 0.025 × 20 = 0.125 °C
    expect(result.self_heating_C).toBeCloseTo(0.125, 3)

    // Operating temp: 40 + 0.125 = 40.125 °C
    expect(result.operating_temp).toBeCloseTo(40.125, 2)

    // Lifetime: 2000 × 2^((105 − 40.125) / 10) = 179 457.7 h
    expect(result.derated_lifetime_hours).toBeCloseTo(179458, -2) // ±50 h tolerance

    // Years: 179 457.7 / 8760 ≈ 20.49 yr
    expect(result.derated_lifetime_years).toBeCloseTo(20.49, 1)

    // No voltage stress (0.48 < 0.8)
    expect(result.voltage_stress_ratio).toBeCloseTo(0.48, 2)

    // Ripple ratio: 0.5 / 1.5 ≈ 0.333
    expect(result.ripple_current_ratio).toBeCloseTo(0.333, 2)

    // No warnings (> 10 yr, ripple < 80 %, voltage < 80 %)
    expect(result.warnings).toHaveLength(0)

    expect(result.base_lifetime_hours).toBe(2000)
    expect(result.temp_rated).toBe(105)
  })

  it('test B — hot ambient + high ripple → critically short lifetime', () => {
    const result = estimateLifetime(BASE_CAP, {
      irms_actual: 1.2,
      vdc: 12,
      ambient_temp_C: 85,
    })

    // Self-heating: 1.2² × 0.025 × 20 = 0.72 °C
    expect(result.self_heating_C).toBeCloseTo(0.72, 3)

    // T_op ≈ 85.72 °C
    expect(result.operating_temp).toBeCloseTo(85.72, 1)

    // Lifetime: 2000 × 2^((105 − 85.72)/10) = 2000 × 2^1.928 = 7 610.5 h
    expect(result.derated_lifetime_hours).toBeCloseTo(7610.5, 0)

    // Years: 7610 / 8760 ≈ 0.869
    expect(result.derated_lifetime_years).toBeCloseTo(0.869, 2)

    // Should have the critically short lifetime warning
    expect(result.warnings.some(w => w.includes('critically short'))).toBe(true)
  })

  it('test C — voltage stress > 80% triggers derating', () => {
    const result = estimateLifetime(BASE_CAP, {
      irms_actual: 0.5,
      vdc: 22,         // 22/25 = 0.88 > 0.8
      ambient_temp_C: 40,
    })

    expect(result.voltage_stress_ratio).toBeCloseTo(0.88, 2)

    // voltage_factor = (25/22)^3 ≈ 1.4645
    // L_derated ≈ 179 457.7 × 1.4645 ≈ 262 810 h ≈ 30.0 yr
    expect(result.derated_lifetime_years).toBeCloseTo(30.0, 0)

    // Should have voltage derating warning
    expect(result.warnings.some(w => w.includes('higher voltage rating'))).toBe(true)
  })

  it('ripple current > 80% of rated triggers warning', () => {
    const result = estimateLifetime(BASE_CAP, {
      irms_actual: 1.3,  // 1.3 / 1.5 = 0.867 > 0.8
      vdc: 12,
      ambient_temp_C: 40,
    })

    expect(result.ripple_current_ratio).toBeGreaterThan(0.8)
    expect(result.warnings.some(w => w.includes('ripple current limit'))).toBe(true)
  })

  it('uses defaults when lifetime_hours and temp_rating are absent', () => {
    const cap = { esr_mohm: 25, ripple_current_a: 1.5, voltage_v: 25, type: 'electrolytic' }
    const result = estimateLifetime(cap, { irms_actual: 0.1, vdc: 12, ambient_temp_C: 25 })

    // Defaults: 2000 h / 105 °C
    expect(result.base_lifetime_hours).toBe(2000)
    expect(result.temp_rated).toBe(105)

    // At 25 °C ambient with negligible self-heating: lifetime should be very long
    expect(result.derated_lifetime_years).toBeGreaterThan(50)
  })

  it('custom Rth_cap overrides the default 20 °C/W', () => {
    const resultDefault = estimateLifetime(BASE_CAP, {
      irms_actual: 1.0,
      vdc: 12,
      ambient_temp_C: 40,
    })
    const resultCustom = estimateLifetime(BASE_CAP, {
      irms_actual: 1.0,
      vdc: 12,
      ambient_temp_C: 40,
      rth_cap: 40,  // higher Rth → more self-heating → shorter life
    })

    // Higher Rth → higher operating temp → shorter lifetime
    expect(resultCustom.self_heating_C).toBeGreaterThan(resultDefault.self_heating_C)
    expect(resultCustom.derated_lifetime_hours).toBeLessThan(resultDefault.derated_lifetime_hours)
  })
})
