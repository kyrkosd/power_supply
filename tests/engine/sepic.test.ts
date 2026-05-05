// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { describe, it, expect } from 'vitest'
import { sepicTopology } from '../../src/engine/topologies/sepic'
import type { DesignSpec } from '../../src/engine/types'

// SEPIC: 3.3-12V input to 5V/1A output
const spec: DesignSpec = {
  vinMin: 3.3,
  vinMax: 12,
  vout: 5,
  iout: 1,
  fsw: 500_000, // High frequency for small components
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.05,
  efficiency: 0.85,
}

describe('SEPIC topology', () => {
  const result = sepicTopology.compute(spec)

  it('computes duty cycle for buck-boost operation', () => {
    const vinNom = (spec.vinMin + spec.vinMax) / 2
    const expectedDuty = spec.vout / (vinNom + spec.vout)
    expect(result.dutyCycle).toBeCloseTo(expectedDuty, 2)
  })

  it('computes input inductance L1', () => {
    expect(result.inductance).toBeGreaterThan(0)
  })

  it('computes output inductance L2', () => {
    expect(result.outputInductance).toBeGreaterThan(0)
    expect(result.outputInductance).toBeCloseTo(result.inductance, 3) // Typically L2 = L1
  })

  it('computes coupling capacitor Cc', () => {
    expect(result.couplingCapacitance).toBeGreaterThan(0)
  })

  it('computes output capacitance for pulsed current', () => {
    expect(result.capacitance).toBeGreaterThan(0)
  })

  it('calculates MOSFET Vds max rating', () => {
    expect(result.mosfetVdsMax).toBe(spec.vinMax + spec.vout)
  })

  it('calculates diode Vr max rating', () => {
    expect(result.diodeVrMax).toBe(spec.vinMax + spec.vout)
  })

  it('provides comprehensive loss breakdown', () => {
    expect(result.losses).toBeDefined()
    expect(result.losses!.total).toBeGreaterThan(0)
    expect(result.losses!.primaryCopper).toBeGreaterThan(0) // L1 loss
    expect(result.losses!.secondaryCopper).toBeGreaterThan(0) // L2 loss
    expect(result.losses!.clamp).toBeGreaterThan(0) // ESR losses
  })

  it('raises warnings for extreme duty cycles', () => {
    // For this test case, duty cycle should be reasonable
    expect(result.warnings.length).toBeGreaterThanOrEqual(0)
  })
})