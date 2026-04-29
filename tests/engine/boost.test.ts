import { describe, it, expect } from 'vitest'
import { boostTopology } from '../../src/engine/topologies/boost'
import type { DesignSpec } from '../../src/engine/types'

const spec: DesignSpec = {
  vinMin: 5,
  vinMax: 8,
  vout: 12,
  iout: 1,
  fsw: 100_000,
  efficiency: 0.9
}

describe('Boost topology', () => {
  const result = boostTopology.compute(spec)

  it('duty cycle equals 1 - Vinmin/Vout', () => {
    expect(result.dutyCycle).toBeCloseTo(1 - 5 / 12, 6)
  })

  it('duty cycle is between 0 and 1', () => {
    expect(result.dutyCycle).toBeGreaterThan(0)
    expect(result.dutyCycle).toBeLessThan(1)
  })

  it('inductance is positive', () => {
    expect(result.inductance).toBeGreaterThan(0)
  })

  it('peak current is greater than average input current', () => {
    const D = result.dutyCycle
    const avgInput = spec.iout / (1 - D)
    expect(result.peakCurrent).toBeGreaterThan(avgInput)
  })
})
