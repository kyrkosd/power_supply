import { describe, it, expect } from 'vitest'
import { buckTopology } from '../../src/engine/topologies/buck'
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

describe('Buck topology', () => {
  const result = buckTopology.compute(spec)

  it('computes duty cycle as Vout/Vinmax', () => {
    expect(result.dutyCycle).toBeCloseTo(5 / 15, 6)
  })

  it('duty cycle is between 0 and 1', () => {
    expect(result.dutyCycle).toBeGreaterThan(0)
    expect(result.dutyCycle).toBeLessThan(1)
  })

  it('inductance is positive', () => {
    expect(result.inductance).toBeGreaterThan(0)
  })

  it('capacitance is positive', () => {
    expect(result.capacitance).toBeGreaterThan(0)
  })

  it('peak current is greater than average output current', () => {
    expect(result.peakCurrent).toBeGreaterThan(spec.iout)
  })

  it('inductance is in a sensible range (µH–mH) for these params', () => {
    expect(result.inductance).toBeGreaterThan(1e-6)   // > 1 µH
    expect(result.inductance).toBeLessThan(1e-2)      // < 10 mH
  })
})

describe('Buck topology — edge cases', () => {
  it('higher switching frequency yields smaller inductance', () => {
    const low  = buckTopology.compute({ ...spec, fsw: 50_000 })
    const high = buckTopology.compute({ ...spec, fsw: 500_000 })
    expect(high.inductance).toBeLessThan(low.inductance)
  })

  it('higher load current yields same duty cycle (CCM)', () => {
    const light = buckTopology.compute({ ...spec, iout: 0.5 })
    const heavy = buckTopology.compute({ ...spec, iout: 5 })
    expect(heavy.dutyCycle).toBeCloseTo(light.dutyCycle, 6)
  })
})
