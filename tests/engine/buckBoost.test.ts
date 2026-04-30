import { describe, it, expect } from 'vitest'
import { buckBoostTopology } from '../../src/engine/topologies/buckBoost'
import type { DesignSpec } from '../../src/engine/types'

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

  it('computes the expected duty cycle for an inverting 12V to -5V design', () => {
    expect(result.dutyCycle).toBeCloseTo(0.316456, 6)
  })

  it('computes a positive inductance value', () => {
    expect(result.inductance).toBeGreaterThan(0)
  })

  it('computes the correct output capacitance for the pulsed output current', () => {
    expect(result.capacitance).toBeCloseTo(12.658e-6, 6)
  })

  it('computes the expected peak current above the average input current', () => {
    const avgInput = spec.iout / (1 - result.dutyCycle)
    expect(result.peakCurrent).toBeGreaterThan(avgInput)
  })

  it('raises a right-half-plane zero warning for the high-frequency design', () => {
    expect(result.warnings.some((warn) => warn.includes('Right-half-plane'))).toBe(true)
  })
})
