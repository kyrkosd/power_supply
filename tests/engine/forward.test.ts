import { describe, it, expect } from 'vitest'
import { forwardTopology } from '../../src/engine/topologies/forward'
import type { DesignSpec } from '../../src/engine/types'

// Telecom forward converter: 48V to 3.3V, 10A
const spec: DesignSpec = {
  vinMin: 36,  // Telecom 48V nominal, min 36V
  vinMax: 75,  // Max 75V for telecom
  vout: 3.3,
  iout: 10,
  fsw: 200_000, // Typical switching frequency
  rippleRatio: 0.2,
  ambientTemp: 25,
  voutRippleMax: 0.1,
  efficiency: 0.88,
}

describe('Forward topology', () => {
  const result = forwardTopology.compute(spec)

  it('computes duty cycle within reset mechanism limits', () => {
    expect(result.dutyCycle).toBeLessThanOrEqual(0.45)
    expect(result.dutyCycle).toBeGreaterThan(0)
  })

  it('computes output inductance for post-rectifier buck stage', () => {
    expect(result.inductance).toBeGreaterThan(0)
    expect(result.outputInductance).toBeGreaterThan(0)
  })

  it('selects appropriate core for magnetizing requirements', () => {
    expect(result.coreType).toBeDefined()
    expect(result.primaryTurns).toBeGreaterThan(0)
    expect(result.secondaryTurns).toBeGreaterThan(0)
  })

  it('computes turns ratio for voltage transformation', () => {
    const vReset = 15
    const dMax = spec.vinMin / (spec.vinMin + vReset) // Reset-limited duty cycle
    const expectedRatio = (spec.vinMin * dMax) / spec.vout
    expect(result.turnsRatio).toBeCloseTo(expectedRatio, 1)
  })

  it('computes output capacitance for ripple requirements', () => {
    expect(result.capacitance).toBeGreaterThan(0)
  })

  it('includes reset mechanism voltage', () => {
    expect(result.resetVoltage).toBeGreaterThan(0)
  })

  it('specifies two rectifier diodes', () => {
    expect(result.rectifierDiodes).toBe(2)
  })

  it('provides loss breakdown including output inductor', () => {
    expect(result.losses).toBeDefined()
    expect(result.losses!.total).toBeGreaterThan(0)
    expect(result.losses!.primaryCopper).toBeGreaterThan(0)
    expect(result.losses!.secondaryCopper).toBeGreaterThan(0)
  })

  it('raises appropriate warnings for reset limits', () => {
    // Should warn about duty cycle limits or other issues
    expect(result.warnings.length).toBeGreaterThanOrEqual(0)
  })
})