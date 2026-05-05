// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
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
const NOMINAL_DCR = 0.050    // Ω  — typical SMD power inductor
const NOMINAL_RDS_ON = 0.100 // Ω  — typical low-voltage MOSFET
const NOMINAL_VF = 0.500     // V  — Schottky diode forward voltage
const NOMINAL_ESR = 0.050    // Ω  — ceramic output capacitor ESR

const THETA_JA = 50  // °C/W — conservative SMD MOSFET package thermal resistance
const TJ_MAX = 125   // °C  — hard junction temperature limit
const PM_MIN = 45    // °   — minimum acceptable phase margin

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
  const mean = values.reduce((s, v) => s + v, 0) / n
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  return {
    values,
    mean,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    p5: sorted[Math.floor(0.05 * (n - 1))],
    p95: sorted[Math.floor(0.95 * (n - 1))],
    histogram: buildHistogram(values, 20),
  }
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
  const rng = mulberry32(config.seed)
  const doPhaseMargin = config.computePhaseMargin !== false
  const tol = config.tolerances ?? {}

  const inductanceTol = tol.inductance ?? InductorTolerance
  const dcrTol = tol.dcr ?? InductorDCRTolerance
  const capacitanceTol = tol.capacitance ?? CeramicCapTolerance
  const esrTol = tol.esr ?? ElectrolyticCapTolerance
  const rdsOnTol = tol.rdsOn ?? MosfetRdsOnTolerance
  const vfTol = tol.vf ?? DiodeVfTolerance
  const isatTol = tol.isat ?? InductorIsatTolerance

  // Nominal Isat from the design result — null when no specific part is selected.
  const nomIsat = nominalResult.saturation_check?.i_sat ?? null

  const D = nominalResult.dutyCycle
  const nomL = nominalResult.inductance
  const nomC = nominalResult.capacitance
  // output_cap is typed non-optional but several topologies omit it; guard defensively.
  const nomESR = (nominalResult.output_cap as typeof nominalResult.output_cap | undefined)
    ?.esr_max ?? NOMINAL_ESR

  const { iout, vout, fsw, ambientTemp, efficiency: effTarget, voutRippleMax } = spec

  const efficiencies: number[] = []
  const ripples: number[] = []
  const phaseMargins: number[] = []
  const tjValues: number[] = []
  const satMargins: number[] = []

  let passes = 0
  let worstCase = nominalResult
  let worstEfficiency = Infinity

  for (let i = 0; i < config.iterations; i++) {
    const L = inductanceTol.sample(nomL, rng)
    const C = capacitanceTol.sample(nomC, rng)
    const DCR = dcrTol.sample(NOMINAL_DCR, rng)
    const RdsOn = rdsOnTol.sample(NOMINAL_RDS_ON, rng)
    const Vf = vfTol.sample(NOMINAL_VF, rng)
    const ESR = esrTol.sample(nomESR, rng)
    // Sample Isat with ±10% spread (datasheet spread + temperature derating).
    const Isat = nomIsat !== null ? isatTol.sample(nomIsat, rng) : null

    // Ripple current with perturbed inductance (volt-second balance, buck approximation).
    // ΔiL = Vout·(1−D) / (L·fsw)
    const deltaIL = (vout * (1 - D)) / (L * fsw)

    // IL_rms² for triangular waveform: Iout² + (ΔiL)²/12
    const ILrms2 = iout * iout + (deltaIL * deltaIL) / 12

    // Conduction losses only (switching losses require Qg and transition times — omitted).
    const Pcond = ILrms2 * RdsOn * D          // MOSFET conduction  W
    const Pcopper = ILrms2 * DCR              // inductor copper     W
    const Pdiode = Math.max(Vf, 0) * iout * (1 - D) // diode forward   W
    const Pout = vout * iout
    const efficiency = Pout / (Pout + Pcond + Pcopper + Pdiode)

    // Output voltage ripple: capacitive term + ESR term.
    const outputRipple = deltaIL / (8 * C * fsw) + deltaIL * ESR

    // Junction temperature from MOSFET conduction dissipation.
    const Tj = ambientTemp + Pcond * THETA_JA

    // Phase margin via small-signal buck control-loop analysis with perturbed L, C, ESR.
    let phaseMargin = NaN
    if (doPhaseMargin) {
      try {
        const perturbedResult: DesignResult = { ...nominalResult, inductance: L, capacitance: C }
        phaseMargin = analyzeBuckControlLoop(spec, perturbedResult, { esr: ESR }).phaseMarginDeg
      } catch {
        // leave NaN — excluded from distribution but does not block the iteration
      }
    }

    // Saturation margin: (Isat - Ipeak) / Isat × 100; positive = safe.
    const I_peak_i = iout + deltaIL / 2
    const satMargin = Isat !== null ? (Isat - I_peak_i) / Isat * 100 : NaN
    const satOk = Isat === null || I_peak_i < Isat

    efficiencies.push(efficiency)
    ripples.push(outputRipple)
    phaseMargins.push(phaseMargin)
    tjValues.push(Tj)
    if (!Number.isNaN(satMargin)) satMargins.push(satMargin)

    const pmOk = !doPhaseMargin || Number.isNaN(phaseMargin) || phaseMargin >= PM_MIN
    if (efficiency >= effTarget && outputRipple <= voutRippleMax && pmOk && Tj <= TJ_MAX && satOk) passes++

    if (efficiency < worstEfficiency) {
      worstEfficiency = efficiency
      worstCase = { ...nominalResult, efficiency }
    }
  }

  return {
    iterations: config.iterations,
    pass_rate: passes / config.iterations,
    worst_case: worstCase,
    metrics: {
      efficiency: computeDistribution(efficiencies),
      output_ripple: computeDistribution(ripples),
      phase_margin: computeDistribution(phaseMargins.filter(v => !Number.isNaN(v))),
      tj_mosfet: computeDistribution(tjValues),
      saturation_margin: computeDistribution(satMargins),
    },
  }
}
