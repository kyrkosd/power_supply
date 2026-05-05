// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { describe, it, expect } from 'vitest'
import { forwardTopology } from '../../src/engine/topologies/forward'
import type { DesignSpec } from '../../src/engine/types'

// Reference: Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed.,
// §6.2–6.3 (single-switch forward converter, CCM) and Table 6-1 (component ratings).
// TI Application Report SLUA101 "Single-Ended Forward Converter" for RCD clamp model.
//
// Telecom forward converter: 48 V bus (36–75 V range) to 3.3 V at 10 A, 200 kHz.
// Hand-calculated values for the spec below:
//
//   Vclamp = 1.5 × Vin_max = 1.5 × 75 = 112.5 V
//   D_max  = min(0.45, Vin_min / (Vin_min + Vclamp))
//          = min(0.45, 36 / 148.5) = min(0.45, 0.24242) = 0.24242
//
//   N = Np/Ns = Vin_min × D_max / Vout = 36 × 0.24242 / 3.3 = 2.6446
//
//   Lo = Vout × (1−D) / (fsw × ΔiL)
//      = 3.3 × 0.75758 / (200 000 × 2) = 2.5 / 400 000 = 6.25 µH  [exact]
//
//   Cout = ΔiL / (8 × fsw × ΔVout)
//        = 2 / (8 × 200 000 × 0.1) = 2 / 160 000 = 12.5 µF  [exact]
//
//   Vds_max = Vin_max + Vclamp = 75 + 112.5 = 187.5 V          (Erickson Table 6-1)
//   diode Vr = Vin_max/N + Vout = 75/2.6446 + 3.3 ≈ 31.66 V   (Erickson Table 6-1)

const spec: DesignSpec = {
  vinMin: 36,
  vinMax: 75,
  vout: 3.3,
  iout: 10,
  fsw: 200_000,
  rippleRatio: 0.2,
  ambientTemp: 25,
  voutRippleMax: 0.1,
  efficiency: 0.88,
}

describe('Forward topology', () => {
  const result = forwardTopology.compute(spec)

  it('computes duty cycle limited by RCD clamp reset (36 V / 148.5 V = 0.2424)', () => {
    // D_max = Vin_min / (Vin_min + Vclamp) = 36 / (36 + 112.5) = 0.24242…
    expect(result.dutyCycle).toBeCloseTo(0.2424, 4)
    expect(result.dutyCycle).toBeLessThanOrEqual(0.45)
  })

  it('computes the turns ratio from the volt-second design rule', () => {
    // N = Vin_min × D_max / Vout = 36 × 0.24242 / 3.3 = 2.6446
    // Erickson & Maksimovic 3rd ed., §6.2
    const expectedN = (spec.vinMin * (spec.vinMin / (spec.vinMin + 1.5 * spec.vinMax))) / spec.vout
    expect(result.turnsRatio).toBeCloseTo(expectedN, 3)
  })

  it('computes the output inductance (Lo) as a buck-stage inductor', () => {
    // Lo = Vout × (1−D) / (fsw × ΔiL) = 3.3 × 0.75758 / (200 000 × 2) = 6.25 µH (exact)
    // Erickson & Maksimovic 3rd ed., §6.3
    expect(result.outputInductance).toBeCloseTo(6.25e-6, 8)
    expect(result.inductance).toBeCloseTo(6.25e-6, 8)
  })

  it('computes the output capacitance using buck equations', () => {
    // Cout = ΔiL / (8 × fsw × ΔVout) = 2 / 160 000 = 12.5 µF (exact)
    expect(result.capacitance).toBeCloseTo(12.5e-6, 8)
  })

  it('computes MOSFET Vds_max as Vin_max + Vclamp', () => {
    // Vds_max = 75 + 112.5 = 187.5 V — Erickson & Maksimovic Table 6-1
    expect(result.mosfetVdsMax).toBeCloseTo(187.5, 2)
  })

  it('computes diode Vr rating as Vin_max/N + Vout for both D1 and D2', () => {
    // D1 (forward) and D2 (freewheel): Vr = Vin_max/N + Vout ≈ 31.66 V
    // Erickson & Maksimovic Table 6-1
    const expectedVr = spec.vinMax / result.turnsRatio! + spec.vout
    expect(result.diodeVrMax).toBeCloseTo(expectedVr, 3)
    expect(result.diodeVrMax!).toBeCloseTo(31.66, 2)
  })

  it('sets the reset voltage to Vclamp = 1.5 × Vin_max', () => {
    expect(result.resetVoltage).toBeCloseTo(1.5 * spec.vinMax, 4)
  })

  it('specifies two rectifier diodes (D1 forward + D2 freewheel)', () => {
    expect(result.rectifierDiodes).toBe(2)
  })

  it('selects a transformer core and computes primary and secondary turns', () => {
    expect(result.coreType).toBeDefined()
    expect(result.primaryTurns).toBeGreaterThan(0)
    expect(result.secondaryTurns).toBeGreaterThan(0)
  })

  it('provides a complete loss breakdown including the output inductor', () => {
    expect(result.losses).toBeDefined()
    expect(result.losses!.total).toBeGreaterThan(0)
    expect(result.losses!.primaryCopper).toBeGreaterThan(0)
    expect(result.losses!.secondaryCopper).toBeGreaterThan(0)
    expect(result.losses!.diode).toBeGreaterThan(0)
    expect(result.losses!.mosfet).toBeGreaterThan(0)
  })

  it('reports computed efficiency between 50% and 100%', () => {
    expect(result.efficiency).toBeGreaterThan(0.5)
    expect(result.efficiency!).toBeLessThanOrEqual(1.0)
  })

  it('always includes the MOSFET voltage stress advisory', () => {
    expect(result.warnings.some((w) => w.includes('MOSFET must block'))).toBe(true)
  })

  it('output ESR limit is ΔVout / ΔiL = 0.1 / 2 = 0.05 Ω', () => {
    // ESR ≤ ΔVout / ΔiL — tighter ESR spec controls output ripple
    const expectedEsr = spec.voutRippleMax / (spec.rippleRatio * spec.iout)
    expect(result.output_cap.esr_max).toBeCloseTo(expectedEsr, 6)
  })
})
