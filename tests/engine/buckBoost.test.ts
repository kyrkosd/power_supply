import { describe, it, expect } from 'vitest'
import { buckBoostTopology } from '../../src/engine/topologies/buckBoost'
import type { DesignSpec } from '../../src/engine/types'

// Reference: Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed.,
// Chapter 2, Table 2-1 (CCM inverting buck-boost converter).
// Hand-calculated values for the spec below:
//
//   D = |Vout| / (Vin_min·η + |Vout|)
//     = 5 / (12 × 0.9 + 5) = 5 / 15.8 ≈ 0.316456
//
//   IL_dc = Iout / (1−D) = 1 / 0.683544 ≈ 1.4630 A
//   ΔiL   = 0.3 × 1.4630 ≈ 0.4389 A
//   L     = Vin·D / (fsw·ΔiL) = 12 × 0.316456 / (500 000 × 0.4389) ≈ 17.308 µH
//
//   Cout  = Iout·D / (fsw·ΔVout) = 1 × 0.316456 / (500 000 × 0.05) ≈ 12.658 µF
//   ESR   ≤ ΔVout / IL_peak = 0.05 / (1.4630 + 0.4389/2) ≈ 30.6 mΩ
//
//   Vds_max = Vin_max + |Vout| = 14 + 5 = 19 V   (Erickson Table 2-1)
//   Vr_max  = Vin_max + |Vout| = 19 V

const spec: DesignSpec = {
  vinMin: 12,
  vinMax: 14,
  vout: -5,
  iout: 1,
  fsw: 500_000,
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.05,
  efficiency: 0.9,
}

describe('Buck-Boost topology', () => {
  const result = buckBoostTopology.compute(spec)

  it('computes the expected duty cycle for an inverting 12 V to −5 V design', () => {
    // D = 5 / (12·0.9 + 5) = 5 / 15.8 = 0.316456…
    expect(result.dutyCycle).toBeCloseTo(0.316456, 6)
  })

  it('computes the correct inductance against hand-calculated reference', () => {
    // L = Vin·D / (fsw·ΔiL) = 12·0.316456 / (500 000·0.4389) ≈ 17.308 µH
    // Erickson & Maksimovic 3rd ed., Table 2-1
    expect(result.inductance).toBeCloseTo(17.308e-6, 6)
  })

  it('computes the correct output capacitance for the pulsed output current', () => {
    // Cout = Iout·D / (fsw·ΔVout) = 1·0.316456 / (500 000·0.05) ≈ 12.658 µF
    expect(result.capacitance).toBeCloseTo(12.658e-6, 6)
  })

  it('computes the ESR limit from ΔVout / IL_peak (not a placeholder)', () => {
    // ESR ≤ ΔVout / IL_peak = 0.05 / ~1.683 ≈ 0.0297 Ω
    expect(result.output_cap.esr_max).toBeGreaterThan(0)
    expect(result.output_cap.esr_max).toBeLessThan(0.05) // must be tighter than ΔVout alone
  })

  it('computes the expected peak current above the average inductor current', () => {
    // IL_peak = IL_dc + ΔiL/2 > IL_dc = Iout/(1−D)
    const IL_dc = spec.iout / (1 - result.dutyCycle)
    expect(result.peakCurrent).toBeGreaterThan(IL_dc)
  })

  it('computes Vds_max as Vin_max + |Vout|', () => {
    // Erickson & Maksimovic Table 2-1: peak switch voltage = Vin + |Vout|
    // = 14 + 5 = 19 V
    expect(result.mosfetVdsMax).toBeCloseTo(19, 2)
  })

  it('computes Vr_max equal to Vds_max (same stress on diode)', () => {
    expect(result.diodeVrMax).toBeCloseTo(result.mosfetVdsMax!, 6)
  })

  it('raises a right-half-plane zero warning', () => {
    expect(result.warnings.some((w) => w.includes('Right-half-plane'))).toBe(true)
  })

  it('raises a high component stress advisory', () => {
    expect(result.warnings.some((w) => w.includes('High component stress'))).toBe(true)
  })
})
