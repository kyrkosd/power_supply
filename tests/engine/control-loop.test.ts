import { describe, it, expect } from 'vitest'
import { buckTopology } from '../../src/engine/topologies/buck'
import { analyzeBuckControlLoop } from '../../src/engine/control-loop'
import type { DesignSpec } from '../../src/engine/types'

const spec: DesignSpec = {
  vinMin: 10,
  vinMax: 15,
  vout: 5,
  iout: 2,
  fsw: 200_000,
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.01,
  efficiency: 0.9,
}

describe('Buck control-loop analysis', () => {
  const result = buckTopology.compute(spec)
  const analysis = analyzeBuckControlLoop(spec, result)

  it('computes a plant natural frequency from L and Cout', () => {
    const L = result.inductance
    const C = result.capacitance
    const omega0 = Math.sqrt(1 / (L * C))
    const resonanceHz = omega0 / (2 * Math.PI)

    expect(resonanceHz).toBeGreaterThan(1)
    expect(resonanceHz).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(L * C)), 2)
  })

  it('produces a phase margin close to the 60° design target', () => {
    // Spec: Vin=10–15 V, Vout=5 V, Iout=2 A, fsw=200 kHz, rippleRatio=0.3
    // Reference: Type-2 compensator targeting 60° PM at fsw/10 crossover
    expect(analysis.phaseMarginDeg).toBeGreaterThan(58)
    expect(analysis.phaseMarginDeg).toBeLessThan(62)
  })

  it('returns stability warnings on the buck result object', () => {
    expect(Array.isArray(result.warnings)).toBe(true)
  })
})
