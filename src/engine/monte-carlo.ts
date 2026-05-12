// Monte Carlo tolerance analysis for switching power supply designs.
// Samples perturbed component values and evaluates efficiency, ripple, thermal, and stability.

import type { Topology, DesignSpec, DesignResult } from './types'
import { analyzeBuckControlLoop } from './control-loop'
import {
  mulberry32,
  ToleranceModel,
  InductorTolerance,
  InductorDCRTolerance,
  CeramicCapTolerance,
  ElectrolyticCapTolerance,
  MosfetRdsOnTolerance,
  DiodeVfTolerance,
  InductorIsatTolerance,
} from './tolerances'

export interface MonteCarloConfig {
  iterations: number
  seed: number
  /** Set false to skip the Bode-based phase-margin calculation (faster, useful in tests). */
  computePhaseMargin?: boolean
  /** Override individual tolerance models — pass noTolerance for zero-spread baseline runs. */
  tolerances?: {
    inductance?: ToleranceModel
    dcr?: ToleranceModel
    capacitance?: ToleranceModel
    esr?: ToleranceModel
    rdsOn?: ToleranceModel
    vf?: ToleranceModel
    isat?: ToleranceModel
  }
}

export interface MCDistribution {
  values: number[]
  mean: number
  std: number
  min: number
  max: number
  p5: number
  p95: number
  histogram: Array<{ bin_center: number; count: number }>
}

export interface MonteCarloResult {
  iterations: number
  pass_rate: number
  worst_case: DesignResult
  metrics: {
    efficiency: MCDistribution
    output_ripple: MCDistribution
    phase_margin: MCDistribution
    tj_mosfet: MCDistribution
    saturation_margin: MCDistribution
  }
}

// Fallback parasitic assumptions when the topology result does not carry them.
const NOMINAL_DCR    = 0.050  // Ω  — typical SMD power inductor
const NOMINAL_RDS_ON = 0.100  // Ω  — typical low-voltage MOSFET
const NOMINAL_VF     = 0.500  // V  — Schottky diode forward voltage
const NOMINAL_ESR    = 0.050  // Ω  — ceramic output capacitor ESR

const THETA_JA = 50   // °C/W — conservative SMD MOSFET package thermal resistance
const TJ_MAX   = 125  // °C  — hard junction temperature limit
const PM_MIN   = 45   // °   — minimum acceptable phase margin

function buildHistogram(values: number[], bins: number): Array<{ bin_center: number; count: number }> {
  if (values.length === 0) return Array.from({ length: bins }, (_, i) => ({ bin_center: i, count: 0 }))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const width = (hi - lo || 1) / bins
  const hist = Array.from({ length: bins }, (_, i) => ({ bin_center: lo + (i + 0.5) * width, count: 0 }))
  for (const v of values) {
    hist[Math.min(Math.floor((v - lo) / width), bins - 1)].count++
  }
  return hist
}

function computeDistribution(values: number[]): MCDistribution {
  const n = values.length
  if (n === 0) return { values: [], mean: NaN, std: NaN, min: NaN, max: NaN, p5: NaN, p95: NaN, histogram: [] }
  const sorted = [...values].sort((a, b) => a - b)
  const mean   = values.reduce((s, v) => s + v, 0) / n
  const std    = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  return {
    values,
    mean,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    p5:  sorted[Math.floor(0.05 * (n - 1))],
    p95: sorted[Math.floor(0.95 * (n - 1))],
    histogram: buildHistogram(values, 20),
  }
}

interface SampledComponents {
  L: number; C: number; DCR: number; RdsOn: number; Vf: number; ESR: number; Isat: number | null
}

/** Sample one set of perturbed component values from the configured tolerance models. */
function sampleComponents(
  rng: () => number,
  tols: Required<NonNullable<MonteCarloConfig['tolerances']>>,
  nomL: number,
  nomC: number,
  nomESR: number,
  nomIsat: number | null,
): SampledComponents {
  return {
    L:     tols.inductance.sample(nomL, rng),
    C:     tols.capacitance.sample(nomC, rng),
    DCR:   tols.dcr.sample(NOMINAL_DCR, rng),
    RdsOn: tols.rdsOn.sample(NOMINAL_RDS_ON, rng),
    Vf:    tols.vf.sample(NOMINAL_VF, rng),
    ESR:   tols.esr.sample(nomESR, rng),
    Isat:  nomIsat !== null ? tols.isat.sample(nomIsat, rng) : null,
  }
}

interface IterationMetrics {
  efficiency: number
  outputRipple: number
  phaseMargin: number
  Tj: number
  satMargin: number
  pass: boolean
}

/** Compute all per-iteration metrics from the sampled component values. */
function computeIterationMetrics(
  s: SampledComponents,
  D: number,
  spec: DesignSpec,
  nominalResult: DesignResult,
  doPhaseMargin: boolean,
): IterationMetrics {
  const { L, C, DCR, RdsOn, Vf, ESR, Isat } = s
  const { iout, vout, fsw, ambientTemp, efficiency: effTarget, voutRippleMax } = spec

  // Ripple current with perturbed inductance — volt-second balance, buck approximation.
  // ΔiL = Vout·(1−D) / (L·fsw)
  const deltaIL = (vout * (1 - D)) / (L * fsw)
  const ILrms2  = iout * iout + (deltaIL * deltaIL) / 12

  // Conduction losses only (switching losses require Qg — omitted here).
  const Pcond    = ILrms2 * RdsOn * D
  const Pcopper  = ILrms2 * DCR
  const Pdiode   = Math.max(Vf, 0) * iout * (1 - D)
  const Pout     = vout * iout
  const efficiency    = Pout / (Pout + Pcond + Pcopper + Pdiode)
  const outputRipple  = deltaIL / (8 * C * fsw) + deltaIL * ESR
  const Tj            = ambientTemp + Pcond * THETA_JA

  let phaseMargin = NaN
  if (doPhaseMargin) {
    try {
      const perturbedResult: DesignResult = { ...nominalResult, inductance: L, capacitance: C }
      phaseMargin = analyzeBuckControlLoop(spec, perturbedResult, { esr: ESR }).phaseMarginDeg
    } catch {
      // Leave NaN — excluded from distribution but does not block the iteration.
    }
  }

  const I_peak_i = iout + deltaIL / 2
  const satMargin = Isat !== null ? (Isat - I_peak_i) / Isat * 100 : NaN
  const satOk     = Isat === null || I_peak_i < Isat
  const pmOk      = !doPhaseMargin || Number.isNaN(phaseMargin) || phaseMargin >= PM_MIN

  const pass = efficiency >= effTarget && outputRipple <= voutRippleMax && pmOk && Tj <= TJ_MAX && satOk
  return { efficiency, outputRipple, phaseMargin, Tj, satMargin, pass }
}

/**
 * Runs a Monte Carlo tolerance analysis on a topology at a fixed operating point.
 *
 * For each iteration the engine:
 *  1. Samples perturbed L, C, DCR, Rds_on, Vf, ESR from the configured tolerance models.
 *  2. Recomputes inductor ripple current with the perturbed inductance.
 *  3. Derives conduction losses → efficiency and output ripple from first principles.
 *  4. Estimates MOSFET junction temperature from conduction dissipation and θja.
 *  5. Optionally runs a small-signal loop analysis to compute phase margin.
 *
 * The caller supplies the nominal DesignResult from topology.compute() so that
 * the duty cycle and operating point are consistent with the chosen spec.
 */
export function runMonteCarlo(
  _topology: Topology,
  spec: DesignSpec,
  nominalResult: DesignResult,
  config: MonteCarloConfig,
): MonteCarloResult {
  const rng          = mulberry32(config.seed)
  const doPhaseMargin = config.computePhaseMargin !== false
  const tol          = config.tolerances ?? {}

  const resolvedTols: Required<NonNullable<MonteCarloConfig['tolerances']>> = {
    inductance:  tol.inductance  ?? InductorTolerance,
    dcr:         tol.dcr         ?? InductorDCRTolerance,
    capacitance: tol.capacitance ?? CeramicCapTolerance,
    esr:         tol.esr         ?? ElectrolyticCapTolerance,
    rdsOn:       tol.rdsOn       ?? MosfetRdsOnTolerance,
    vf:          tol.vf          ?? DiodeVfTolerance,
    isat:        tol.isat        ?? InductorIsatTolerance,
  }

  const nomL    = nominalResult.inductance
  const nomC    = nominalResult.capacitance
  const nomESR  = (nominalResult.output_cap as typeof nominalResult.output_cap | undefined)
                  ?.esr_max ?? NOMINAL_ESR
  const nomIsat = nominalResult.saturation_check?.i_sat ?? null
  const D       = nominalResult.dutyCycle

  const efficiencies: number[] = []
  const ripples:      number[] = []
  const phaseMargins: number[] = []
  const tjValues:     number[] = []
  const satMargins:   number[] = []

  let passes = 0
  let worstCase       = nominalResult
  let worstEfficiency = Infinity

  for (let i = 0; i < config.iterations; i++) {
    const s = sampleComponents(rng, resolvedTols, nomL, nomC, nomESR, nomIsat)
    const m = computeIterationMetrics(s, D, spec, nominalResult, doPhaseMargin)

    efficiencies.push(m.efficiency)
    ripples.push(m.outputRipple)
    phaseMargins.push(m.phaseMargin)
    tjValues.push(m.Tj)
    if (!Number.isNaN(m.satMargin)) satMargins.push(m.satMargin)
    if (m.pass) passes++

    if (m.efficiency < worstEfficiency) {
      worstEfficiency = m.efficiency
      worstCase = { ...nominalResult, efficiency: m.efficiency }
    }
  }

  return {
    iterations: config.iterations,
    pass_rate:  passes / config.iterations,
    worst_case: worstCase,
    metrics: {
      efficiency:        computeDistribution(efficiencies),
      output_ripple:     computeDistribution(ripples),
      phase_margin:      computeDistribution(phaseMargins.filter(v => !Number.isNaN(v))),
      tj_mosfet:         computeDistribution(tjValues),
      saturation_margin: computeDistribution(satMargins),
    },
  }
}
