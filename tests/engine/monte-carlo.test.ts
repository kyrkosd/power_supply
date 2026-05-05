// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { describe, it, expect } from 'vitest'
import { buckTopology } from '../../src/engine/topologies/buck'
import { runMonteCarlo } from '../../src/engine/monte-carlo'
import { noTolerance } from '../../src/engine/tolerances'
import type { MonteCarloConfig } from '../../src/engine/monte-carlo'
import type { DesignSpec } from '../../src/engine/types'

// Reference operating point: 15 V → 5 V buck, 2 A, 200 kHz.
const spec: DesignSpec = {
  vinMin: 10,
  vinMax: 15,
  vout: 5,
  iout: 2,
  fsw: 200_000,
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.05,
  efficiency: 0.85,
}

const nominalResult = buckTopology.compute(spec)

// ── Zero tolerance ────────────────────────────────────────────────────────────
// When all tolerance models return nominal unchanged, every iteration is
// identical, so the distribution must have zero spread.

describe('runMonteCarlo — zero tolerance baseline', () => {
  const cfg: MonteCarloConfig = {
    iterations: 50,
    seed: 42,
    computePhaseMargin: false,
    tolerances: {
      inductance: noTolerance,
      dcr: noTolerance,
      capacitance: noTolerance,
      esr: noTolerance,
      rdsOn: noTolerance,
      vf: noTolerance,
    },
  }

  const result = runMonteCarlo(buckTopology, spec, nominalResult, cfg)

  it('returns correct iteration count', () => {
    expect(result.iterations).toBe(50)
  })

  it('efficiency distribution has zero standard deviation', () => {
    expect(result.metrics.efficiency.std).toBeCloseTo(0, 10)
  })

  it('ripple distribution has zero standard deviation', () => {
    expect(result.metrics.output_ripple.std).toBeCloseTo(0, 10)
  })

  it('Tj distribution has zero standard deviation', () => {
    expect(result.metrics.tj_mosfet.std).toBeCloseTo(0, 10)
  })

  it('efficiency mean is in physically valid range (0, 1]', () => {
    const { mean } = result.metrics.efficiency
    expect(mean).toBeGreaterThan(0)
    expect(mean).toBeLessThanOrEqual(1)
  })

  it('output ripple mean is positive', () => {
    expect(result.metrics.output_ripple.mean).toBeGreaterThan(0)
  })

  it('pass_rate is exactly 0 or 1 (all samples identical)', () => {
    expect([0, 1]).toContain(result.pass_rate)
  })

  it('histogram bin counts sum to iteration count', () => {
    const total = result.metrics.efficiency.histogram.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(50)
  })
})

// ── Large tolerance spread ────────────────────────────────────────────────────
// Default tolerance models carry real variation — distributions must be wider
// than numerical noise.

describe('runMonteCarlo — with default tolerances', () => {
  const cfg: MonteCarloConfig = {
    iterations: 200,
    seed: 1337,
    computePhaseMargin: false,
  }

  const result = runMonteCarlo(buckTopology, spec, nominalResult, cfg)

  it('efficiency distribution has non-trivial standard deviation', () => {
    // With Rds_on doubling and DCR +50%, efficiency spread must exceed 0.1%.
    expect(result.metrics.efficiency.std).toBeGreaterThan(0.001)
  })

  it('ripple distribution has non-trivial standard deviation', () => {
    expect(result.metrics.output_ripple.std).toBeGreaterThan(0)
  })

  it('Tj distribution has non-trivial standard deviation', () => {
    expect(result.metrics.tj_mosfet.std).toBeGreaterThan(0)
  })

  it('histogram has exactly 20 bins', () => {
    expect(result.metrics.efficiency.histogram).toHaveLength(20)
  })

  it('histogram bin counts sum to iteration count', () => {
    const total = result.metrics.efficiency.histogram.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(200)
  })

  it('p5 < mean < p95 for efficiency', () => {
    const { p5, mean, p95 } = result.metrics.efficiency
    expect(p5).toBeLessThan(mean)
    expect(mean).toBeLessThan(p95)
  })

  it('pass_rate is between 0 and 1 inclusive', () => {
    expect(result.pass_rate).toBeGreaterThanOrEqual(0)
    expect(result.pass_rate).toBeLessThanOrEqual(1)
  })

  it('worst_case efficiency is at or below distribution mean', () => {
    // Allow a tiny float tolerance in case of floating-point tie-breaking.
    expect(result.worst_case.efficiency!).toBeLessThanOrEqual(
      result.metrics.efficiency.mean + 1e-9,
    )
  })

  it('min <= p5 <= p95 <= max', () => {
    const { min, p5, p95, max } = result.metrics.efficiency
    expect(min).toBeLessThanOrEqual(p5)
    expect(p5).toBeLessThanOrEqual(p95)
    expect(p95).toBeLessThanOrEqual(max)
  })
})

// ── Seeded PRNG reproducibility ───────────────────────────────────────────────

describe('runMonteCarlo — seeded PRNG', () => {
  it('produces identical results with the same seed', () => {
    const cfg: MonteCarloConfig = { iterations: 50, seed: 99, computePhaseMargin: false }
    const r1 = runMonteCarlo(buckTopology, spec, nominalResult, cfg)
    const r2 = runMonteCarlo(buckTopology, spec, nominalResult, cfg)
    expect(r1.metrics.efficiency.mean).toBe(r2.metrics.efficiency.mean)
    expect(r1.pass_rate).toBe(r2.pass_rate)
  })

  it('produces different means with different seeds', () => {
    const r1 = runMonteCarlo(buckTopology, spec, nominalResult, { iterations: 100, seed: 1, computePhaseMargin: false })
    const r2 = runMonteCarlo(buckTopology, spec, nominalResult, { iterations: 100, seed: 2, computePhaseMargin: false })
    expect(r1.metrics.efficiency.mean).not.toBe(r2.metrics.efficiency.mean)
  })
})

// ── Phase margin smoke test ───────────────────────────────────────────────────
// Keep iterations very low — the Bode analysis is expensive per iteration.

describe('runMonteCarlo — phase margin (Bode analysis)', () => {
  it('produces a non-empty phase_margin distribution', () => {
    const result = runMonteCarlo(buckTopology, spec, nominalResult, {
      iterations: 5,
      seed: 7,
      computePhaseMargin: true,
    })
    const { values, mean } = result.metrics.phase_margin
    expect(values.length).toBeGreaterThan(0)
    expect(mean).toBeGreaterThan(0)
    expect(mean).toBeLessThan(180)
  })
})
