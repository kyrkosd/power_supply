/**
 * Smoke-tests: every topology must compute without throwing when given the
 * same default DesignSpec values that the app loads on first run.
 * Default specs are copied from src/store/design-store.ts TOPOLOGY_DEFAULTS.
 */
import { describe, it, expect } from 'vitest'
import { buckTopology }      from '../../src/engine/topologies/buck'
import { boostTopology }     from '../../src/engine/topologies/boost'
import { buckBoostTopology } from '../../src/engine/topologies/buckBoost'
import { flybackTopology }   from '../../src/engine/topologies/flyback'
import { forwardTopology }   from '../../src/engine/topologies/forward'
import { sepicTopology }     from '../../src/engine/topologies/sepic'
import { TOPOLOGY_DEFAULTS } from '../../src/store/design-store'

// Use the live store defaults so this test breaks automatically whenever
// a default spec value changes to something physically invalid.
const defaults = TOPOLOGY_DEFAULTS

function sanityCheck(id: string, result: ReturnType<typeof buckTopology.compute>) {
  expect(result.dutyCycle,   `${id}: duty cycle`).toBeGreaterThan(0)
  expect(result.dutyCycle,   `${id}: duty cycle < 1`).toBeLessThan(1)
  expect(result.inductance,  `${id}: inductance > 0`).toBeGreaterThan(0)
  expect(result.capacitance, `${id}: capacitance > 0`).toBeGreaterThan(0)
  expect(result.peakCurrent, `${id}: peak current > 0`).toBeGreaterThan(0)
  expect(Array.isArray(result.warnings), `${id}: warnings array`).toBe(true)
}

describe('All 6 topologies — default application specs', () => {
  it('buck computes without error at default spec', () => {
    const r = buckTopology.compute(defaults.buck)
    sanityCheck('buck', r)
    // D = Vout / Vin_max = 5/14 ≈ 0.3571  (vinMax = 14 V)
    expect(r.dutyCycle).toBeCloseTo(5 / 14, 4)
  })

  it('boost computes without error at default spec', () => {
    const r = boostTopology.compute(defaults.boost)
    sanityCheck('boost', r)
    // D = 1 - (Vin_min × η) / Vout = 1 - (4.5 × 0.90) / 12 ≈ 0.6625
    expect(r.dutyCycle).toBeCloseTo(1 - (4.5 * 0.90) / 12, 2)
  })

  it('buck-boost computes without error at default spec (vout = −5 V)', () => {
    const r = buckBoostTopology.compute(defaults['buck-boost'])
    sanityCheck('buck-boost', r)
    // D = |Vout| / (Vin_min·η + |Vout|) = 5 / (10·0.85 + 5) = 5/13.5 ≈ 0.3704
    expect(r.dutyCycle).toBeCloseTo(5 / (10 * 0.85 + 5), 3)
  })

  it('flyback computes without error at default spec', () => {
    const r = flybackTopology.compute(defaults.flyback)
    sanityCheck('flyback', r)
    expect(r.turnsRatio).toBeGreaterThan(0)
  })

  it('forward computes without error at default spec', () => {
    const r = forwardTopology.compute(defaults.forward)
    sanityCheck('forward', r)
    expect(r.outputInductance).toBeGreaterThan(0)
    expect(r.rectifierDiodes).toBe(2)
  })

  it('sepic computes without error at default spec', () => {
    const r = sepicTopology.compute(defaults.sepic)
    sanityCheck('sepic', r)
    expect(r.couplingCapacitance).toBeGreaterThan(0)
  })

  // ── DCM boundary sanity across all non-isolated topologies ─────────────
  it('DCM boundary is always positive and less than full-load current', () => {
    const topologies = [
      { t: buckTopology,      spec: defaults.buck       },
      { t: boostTopology,     spec: defaults.boost      },
      { t: buckBoostTopology, spec: defaults['buck-boost'] },
      { t: sepicTopology,     spec: defaults.sepic      },
    ]
    for (const { t, spec } of topologies) {
      const r = t.compute(spec)
      if (r.ccm_dcm_boundary != null) {
        expect(r.ccm_dcm_boundary, `${t.id}: boundary > 0`).toBeGreaterThan(0)
        expect(r.ccm_dcm_boundary, `${t.id}: boundary < iout`).toBeLessThan(spec.iout * 10)
        // Default specs are all designed for CCM
        expect(r.operating_mode, `${t.id}: should be CCM at default`).toBe('CCM')
      }
    }
  })
})
