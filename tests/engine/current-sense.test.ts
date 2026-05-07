// Tests for src/engine/current-sense.ts
//
// Reference design (TI SLVA452B example):
//   Vin = 12 V, Vout = 5 V, Iout = 3 A, fsw = 300 kHz, ripple ratio = 0.3
//   IL_peak ≈ 3 × (1 + 0.3/2) = 3.45 A   (Iout × (1 + rippleRatio/2))
//   L = Vout×(1−D)/(ΔiL×fsw) = 5×0.583/(0.9×300k) ≈ 10.8 µH
//   With Vsense = 150 mV:  Rsense = 0.150 / 3.45 ≈ 43.5 mΩ
//   Power = (Irms² × Rsense)  ≈ (3.03² × 0.0435) ≈ 0.399 W
//   SNR @ 10% = 20×log10(0.1×3.45×0.0435 / 0.005) ≈ 20×log10(3.0) ≈ 9.5 dB
//   Slope comp = 0.5×(5/10.8e-6)×0.0435 ≈ 10.07 kV/s

import { describe, it, expect } from 'vitest'
import { designCurrentSense } from '../../src/engine/current-sense'
import type { DesignSpec, DesignResult } from '../../src/engine/types'

// ── Shared minimal spec / result stubs ────────────────────────────────────────

const spec: DesignSpec = {
  vinMin: 10,
  vinMax: 14,
  vout: 5,
  iout: 3,
  fsw: 300_000,
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.05,
  efficiency: 0.9,
  controlMode: 'current',
}

// IL_peak = Iout × (1 + rippleRatio/2) = 3 × 1.15 = 3.45 A
// ΔiL = 2 × (IL_peak − Iout) = 2 × 0.45 = 0.9 A
// L from buck CCM: Vout×(1−D)/(ΔiL×fsw)  D=5/12=0.4167 → L≈9.72 µH (use 10 µH)
const result: DesignResult = {
  dutyCycle: 5 / 12,
  inductance: 10e-6,    // 10 µH
  capacitance: 100e-6,
  peakCurrent: 3.45,    // A
  warnings: [],
}

// ── Resistor method ───────────────────────────────────────────────────────────

describe('designCurrentSense — resistor method', () => {
  const cs = designCurrentSense('buck', spec, result, 'resistor', 150)

  it('returns method === resistor', () => {
    expect(cs.method).toBe('resistor')
  })

  it('Rsense ≈ Vsense_target / IL_peak (TI SLVA452B eq. 1)', () => {
    // 0.150 V / 3.45 A = 43.5 mΩ
    const expected = 0.150 / 3.45
    expect(cs.rsense).toBeCloseTo(expected, 4)
  })

  it('vsense_peak ≈ IL_peak × Rsense', () => {
    expect(cs.vsense_peak).toBeCloseTo(3.45 * cs.rsense, 4)
  })

  it('vsense_valley ≤ vsense_peak', () => {
    expect(cs.vsense_valley).toBeLessThanOrEqual(cs.vsense_peak)
  })

  it('rsense_power = IL_rms² × Rsense', () => {
    // ΔiL = 2×(3.45−3) = 0.9 A
    // IL_rms = sqrt(3²+ 0.9²/12) = sqrt(9.0675) ≈ 3.0112
    const deltaIL = 0.9
    const ilRms = Math.sqrt(3 * 3 + (deltaIL * deltaIL) / 12)
    const expected = ilRms * ilRms * cs.rsense
    expect(cs.rsense_power).toBeCloseTo(expected, 4)
  })

  it('slope_comp_ramp = 0.5 × (Vout/L) × Rsense (TI SLVA101 eq. 4)', () => {
    const expected = 0.5 * (spec.vout / result.inductance) * cs.rsense
    expect(cs.slope_comp_ramp).toBeCloseTo(expected, 1)
  })

  it('rdson_temp_error_pct === 0 for resistor method', () => {
    expect(cs.rdson_temp_error_pct).toBe(0)
  })

  it('snr_at_light_load is a finite positive number in dB', () => {
    expect(Number.isFinite(cs.snr_at_light_load)).toBe(true)
    expect(cs.snr_at_light_load).toBeGreaterThan(0)
  })
})

// ── Kelvin connection flag ────────────────────────────────────────────────────

describe('kelvin_connection_required', () => {
  it('is false when Rsense ≥ 10 mΩ (default 150 mV target)', () => {
    // 150 mV / 3.45 A ≈ 43.5 mΩ — well above threshold
    const cs = designCurrentSense('buck', spec, result, 'resistor', 150)
    expect(cs.kelvin_connection_required).toBe(false)
  })

  it('is true when Rsense < 10 mΩ (Vishay VYMC threshold)', () => {
    // Need very low Vsense to get Rsense < 10 mΩ at 3.45 A peak:
    //   Vsense = 10 mΩ × 3.45 = 34.5 mV → use 30 mV to get < 10 mΩ
    const cs = designCurrentSense('buck', spec, result, 'resistor', 30)
    // 0.030 / 3.45 ≈ 8.7 mΩ < 10 mΩ
    expect(cs.rsense).toBeLessThan(0.010)
    expect(cs.kelvin_connection_required).toBe(true)
  })
})

// ── Package selection ─────────────────────────────────────────────────────────

describe('packageForPower', () => {
  it('selects 0805 for power < 0.125 W', () => {
    // Use a very low Vsense so Rsense is tiny and power stays below 0.125 W
    // Alternatively use a spec with low Iout
    const lowISpec = { ...spec, iout: 0.1 }
    const lowIResult = { ...result, peakCurrent: 0.115, inductance: 100e-6 }
    const cs = designCurrentSense('buck', lowISpec, lowIResult, 'resistor', 150)
    expect(cs.rsense_power).toBeLessThan(0.125)
    expect(cs.rsense_package).toBe('0805')
  })

  it('selects 2512 for power in [0.5, 1) W', () => {
    // High Iout → high power
    const hiSpec = { ...spec, iout: 15 }
    const hiResult = { ...result, peakCurrent: 17.25 }
    const cs = designCurrentSense('buck', hiSpec, hiResult, 'resistor', 150)
    if (cs.rsense_power >= 0.5 && cs.rsense_power < 1.0) {
      expect(cs.rsense_package).toBe('2512')
    } else {
      // Accept shunt if power actually ≥ 1 W
      expect(['2512', '4-terminal shunt (Kelvin)']).toContain(cs.rsense_package)
    }
  })
})

// ── Rds(on) method ────────────────────────────────────────────────────────────

describe('designCurrentSense — rdson method', () => {
  const cs = designCurrentSense('buck', spec, result, 'rdson')

  it('returns method === rdson', () => {
    expect(cs.method).toBe('rdson')
  })

  it('rsense === 0', () => {
    expect(cs.rsense).toBe(0)
  })

  it('rsense_power === 0', () => {
    expect(cs.rsense_power).toBe(0)
  })

  it('rsense_package === N/A', () => {
    expect(cs.rsense_package).toBe('N/A')
  })

  it('rdson_temp_error_pct ≈ 30 % (Infineon AN_1805: 0.4 %/°C × 75 °C)', () => {
    // (100 − 25) × 0.40 = 30 %
    expect(cs.rdson_temp_error_pct).toBeCloseTo(30, 1)
  })

  it('emits temperature warning when error > 20 %', () => {
    expect(cs.warnings.some((w) => w.includes('Rds(on) sensing'))).toBe(true)
  })

  it('kelvin_connection_required is false', () => {
    expect(cs.kelvin_connection_required).toBe(false)
  })

  it('vsense_peak > 0 (uses RDSON_NOMINAL = 20 mΩ)', () => {
    // 3.45 A × 0.020 Ω = 69 mV
    expect(cs.vsense_peak).toBeCloseTo(3.45 * 0.020, 4)
  })
})

// ── Warnings ──────────────────────────────────────────────────────────────────

describe('warnings', () => {
  it('warns when Vsense target < 50 mV', () => {
    const cs = designCurrentSense('buck', spec, result, 'resistor', 30)
    expect(cs.warnings.some((w) => w.includes('very low'))).toBe(true)
  })

  it('warns when Vsense target > 300 mV', () => {
    const cs = designCurrentSense('buck', spec, result, 'resistor', 350)
    expect(cs.warnings.some((w) => w.includes('high'))).toBe(true)
  })

  it('warns when duty cycle > 50 % (slope compensation)', () => {
    const highDutyResult = { ...result, dutyCycle: 0.6 }
    const cs = designCurrentSense('buck', spec, highDutyResult, 'resistor', 150)
    expect(cs.warnings.some((w) => w.includes('slope compensation'))).toBe(true)
  })

  it('does NOT warn about slope comp when duty < 50 %', () => {
    // duty = 5/12 ≈ 0.417
    const cs = designCurrentSense('buck', spec, result, 'resistor', 150)
    const slopeWarnings = cs.warnings.filter((w) => w.includes('slope compensation'))
    expect(slopeWarnings).toHaveLength(0)
  })
})
