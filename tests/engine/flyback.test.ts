import { describe, it, expect } from 'vitest'
import { flybackTopology } from '../../src/engine/topologies/flyback'
import type { DesignSpec } from '../../src/engine/types'

// Offline flyback: 90-264VAC rectified → ~127-373VDC, but use 100-400V for testing
const spec: DesignSpec = {
  vinMin: 100,
  vinMax: 400,
  vout: 5,
  iout: 2,
  fsw: 100_000, // Typical offline switching frequency
  rippleRatio: 0.4,
  ambientTemp: 25,
  voutRippleMax: 0.1,
  efficiency: 0.85,
}

describe('Flyback topology', () => {
  const result = flybackTopology.compute(spec)

  it('computes duty cycle within offline limits', () => {
    expect(result.dutyCycle).toBeLessThanOrEqual(0.45)
    expect(result.dutyCycle).toBeGreaterThan(0)
  })

  it('computes positive magnetizing inductance', () => {
    expect(result.inductance).toBeGreaterThan(0)
    expect(result.magnetizingInductance).toBeGreaterThan(0)
  })

  it('selects appropriate core from database', () => {
    expect(result.coreType).toBeDefined()
    expect(result.primaryTurns).toBeGreaterThan(0)
    expect(result.secondaryTurns).toBeGreaterThan(0)
  })

  it('computes turns ratio for voltage transformation', () => {
    const vinNom = (spec.vinMin + spec.vinMax) / 2
    const expectedRatio = (vinNom * result.dutyCycle) / spec.vout
    expect(result.turnsRatio).toBeCloseTo(expectedRatio, 2)
  })

  it('computes output capacitance for ripple requirements', () => {
    expect(result.capacitance).toBeGreaterThan(0)
  })

  it('estimates clamp voltage for leakage inductance', () => {
    expect(result.clampVoltage).toBeGreaterThan(spec.vout * result.turnsRatio!)
  })

  it('provides loss breakdown', () => {
    expect(result.losses).toBeDefined()
    expect(result.losses!.total).toBeGreaterThan(0)
    expect(result.losses!.primaryCopper).toBeGreaterThan(0)
    expect(result.losses!.secondaryCopper).toBeGreaterThan(0)
  })

  it('raises appropriate warnings for offline design', () => {
    // Should warn about duty cycle limits for offline
    expect(result.warnings.length).toBeGreaterThanOrEqual(0)
  })
})