import { describe, it, expect } from 'vitest'
import { boostTopology } from '../../src/engine/topologies/boost'
import type { DesignSpec } from '../../src/engine/types'

const spec: DesignSpec = {
  vinMin: 5,
  vinMax: 8,
  vout: 12,
  iout: 1,
  fsw: 300_000,
  rippleRatio: 0.3,
  voutRippleMax: 0.12,
  ambientTemp: 25,
  efficiency: 0.9,
}

describe('Boost topology', () => {
  const result = boostTopology.compute(spec)

  it('computes duty cycle for 5V-to-12V at 90% efficiency', () => {
    expect(result.dutyCycle).toBeCloseTo(0.625, 6)
  })

  it('computes the correct inductance for the specified ripple and switching frequency', () => {
    expect(result.inductance).toBeCloseTo(13.0208e-6, 6)
  })

  it('computes the correct output capacitance', () => {
    expect(result.capacitance).toBeCloseTo(17.3611e-6, 6)
  })

  it('computes the expected peak inductor current', () => {
    expect(result.peakCurrent).toBeCloseTo(3.0667, 4)
  })

  it('raises a right-half-plane zero warning for a 300 kHz design', () => {
    expect(result.warnings.some((message) => message.includes('Right-half-plane'))).toBe(true)
  })
})
