// Monte Carlo tolerance analysis: samples perturbed component values and evaluates
// efficiency, ripple, thermal, and stability over `iterations` runs.
//
// Sub-modules:
//   mc/distribution.ts — histogram + mean/std/percentile statistics
//   mc/sample.ts       — tolerance resolution + per-iteration component sampler
//   mc/iteration.ts    — per-iteration metric computation (efficiency, ripple, Tj, PM, sat margin)

import type { Topology, DesignSpec, DesignResult } from './types'
import { mulberry32 } from './tolerances'
import type { ToleranceModel } from './tolerances'
import { computeDistribution, type MCDistribution } from './mc/distribution'
import {
  resolveTolerances, sampleComponents, NOMINAL_ESR,
  type ToleranceOverrides,
} from './mc/sample'
import { computeIterationMetrics } from './mc/iteration'

export type { MCDistribution }

export interface MonteCarloConfig {
  iterations: number
  seed: number
  /** Set false to skip the Bode-based phase-margin calculation (faster, useful in tests). */
  computePhaseMargin?: boolean
  /** Override individual tolerance models — pass noTolerance for zero-spread baseline runs. */
  tolerances?: ToleranceOverrides & {
    // Re-listed here purely so the public type stays self-describing.
    inductance?: ToleranceModel; dcr?: ToleranceModel
    capacitance?: ToleranceModel; esr?: ToleranceModel
    rdsOn?: ToleranceModel; vf?: ToleranceModel; isat?: ToleranceModel
  }
}

export interface MonteCarloResult {
  iterations: number
  pass_rate: number
  worst_case: DesignResult
  metrics: {
    efficiency:        MCDistribution
    output_ripple:     MCDistribution
    phase_margin:      MCDistribution
    tj_mosfet:         MCDistribution
    saturation_margin: MCDistribution
  }
}

interface Aggregator {
  efficiencies: number[]
  ripples:      number[]
  phaseMargins: number[]
  tjValues:     number[]
  satMargins:   number[]
  passes:       number
  worstCase:    DesignResult
  worstEff:     number
}

function newAggregator(nominalResult: DesignResult): Aggregator {
  return {
    efficiencies: [], ripples: [], phaseMargins: [], tjValues: [], satMargins: [],
    passes: 0, worstCase: nominalResult, worstEff: Infinity,
  }
}

function accumulate(agg: Aggregator, m: ReturnType<typeof computeIterationMetrics>, nominal: DesignResult): void {
  agg.efficiencies.push(m.efficiency)
  agg.ripples.push(m.outputRipple)
  agg.phaseMargins.push(m.phaseMargin)
  agg.tjValues.push(m.Tj)
  if (!Number.isNaN(m.satMargin)) agg.satMargins.push(m.satMargin)
  if (m.pass) agg.passes++
  if (m.efficiency < agg.worstEff) {
    agg.worstEff = m.efficiency
    agg.worstCase = { ...nominal, efficiency: m.efficiency }
  }
}

/**
 * Called by: worker/handlers.ts (handleMC, on 'MC_COMPUTE' worker message)
 * Why: runs entirely in the worker so thousands of iterations don't block the renderer.
 * The _topology parameter is accepted but currently unused — it is reserved for topologies
 * that override the default conduction-loss model with their own MC-aware version.
 *
 * Runs a Monte Carlo tolerance analysis on a topology at a fixed operating point.
 * For each iteration: sample components → recompute ripple → derive losses & Tj →
 * optionally analyse loop for phase margin. Pass criterion = all metrics within budget.
 */
export function runMonteCarlo(
  _topology: Topology,
  spec: DesignSpec,
  nominalResult: DesignResult,
  config: MonteCarloConfig,
): MonteCarloResult {
  const rng           = mulberry32(config.seed)
  const doPhaseMargin = config.computePhaseMargin !== false
  const tols          = resolveTolerances(config.tolerances)
  const nominals = {
    L:    nominalResult.inductance,
    C:    nominalResult.capacitance,
    ESR:  (nominalResult.output_cap as typeof nominalResult.output_cap | undefined)?.esr_max ?? NOMINAL_ESR,
    Isat: nominalResult.saturation_check?.i_sat ?? null,
  }
  const D = nominalResult.dutyCycle

  const agg = newAggregator(nominalResult)
  for (let i = 0; i < config.iterations; i++) {
    const s = sampleComponents(rng, tols, nominals)
    const m = computeIterationMetrics(s, D, spec, nominalResult, doPhaseMargin)
    accumulate(agg, m, nominalResult)
  }

  return {
    iterations: config.iterations,
    pass_rate:  agg.passes / config.iterations,
    worst_case: agg.worstCase,
    metrics: {
      efficiency:        computeDistribution(agg.efficiencies),
      output_ripple:     computeDistribution(agg.ripples),
      phase_margin:      computeDistribution(agg.phaseMargins.filter((v) => !Number.isNaN(v))),
      tj_mosfet:         computeDistribution(agg.tjValues),
      saturation_margin: computeDistribution(agg.satMargins),
    },
  }
}
