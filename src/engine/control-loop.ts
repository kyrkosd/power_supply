import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import type { DesignSpec, DesignResult } from './types'

export type ControlMode = 'voltage' | 'current'

export interface BodePoint {
  freq_hz: number
  magnitude_db: number
  phase_deg: number
}

/**
 * Slope compensation data for peak current-mode control.
 * Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §11.3
 */
export interface SlopeCompensation {
  /** Minimum external ramp slope to prevent subharmonic oscillation, in A/s.
   *  (Normalised — multiply by your Rsense in Ω to get V/s.) */
  se_required_aps: number
  /** True when D > 0.5 and no slope compensation is applied. */
  subharmonic_risk: boolean
}

export interface ControlLoopAnalysis {
  frequency_hz: number[]
  plant: BodePoint[]
  compensator: BodePoint[]
  loop: BodePoint[]
  designFrequencyHz: number
  crossoverFrequencyHz: number
  phaseMarginDeg: number
  gainMarginDb: number
  warnings: string[]
  controlMode: ControlMode
  slopeCompensation: SlopeCompensation
}

const RAD_TO_DEG = 180 / Math.PI

function evaluatePolynomial(coeffs: readonly number[], s: ReturnType<typeof complex>) {
  return coeffs.reduce((acc, coeff) => add(multiply(acc, s), coeff) as ReturnType<typeof complex>, complex(0, 0))
}

function evaluateTransferFunction(
  numerator: readonly number[],
  denominator: readonly number[],
  freq_hz: number,
) {
  const s = complex(0, 2 * Math.PI * freq_hz)
  const num = evaluatePolynomial(numerator, s)
  const den = evaluatePolynomial(denominator, s)
  const h = divide(num, den)
  return {
    magnitude_db: 20 * Math.log10(abs(h as Complex)),
    phase_deg: arg(h as Complex) * RAD_TO_DEG,
  }
}

function logspace(start: number, stop: number, count: number) {
  const logStart = Math.log10(start)
  const logStop = Math.log10(stop)
  const step = (logStop - logStart) / (count - 1)
  return Array.from({ length: count }, (_, i) => 10 ** (logStart + step * i))
}

function interpolate(x0: number, y0: number, x1: number, y1: number, x: number) {
  if (x1 === x0) return y0
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

function normalizePhase(phase: number) {
  return (((phase + 180) % 360 + 360) % 360) - 180
}

function findCrossoverPoint(loop: BodePoint[], preferredFreq?: number) {
  const crossings: Array<{ freq: number; phase: number }> = []
  for (let i = 1; i < loop.length; i += 1) {
    const before = loop[i - 1].magnitude_db
    const after = loop[i].magnitude_db
    if (before === 0) {
      crossings.push({ freq: loop[i - 1].freq_hz, phase: loop[i - 1].phase_deg })
    }
    if (after === 0) {
      crossings.push({ freq: loop[i].freq_hz, phase: loop[i].phase_deg })
    }
    if ((before >= 0 && after <= 0) || (before <= 0 && after >= 0)) {
      const freq = interpolate(before, loop[i - 1].freq_hz, after, loop[i].freq_hz, 0)
      const phase = interpolate(loop[i - 1].freq_hz, loop[i - 1].phase_deg, loop[i].freq_hz, loop[i].phase_deg, freq)
      crossings.push({ freq, phase })
    }
  }
  if (crossings.length === 0) return null
  if (preferredFreq === undefined) return crossings[0]
  return crossings.reduce((best, current) => (
    Math.abs(current.freq - preferredFreq) < Math.abs(best.freq - preferredFreq) ? current : best
  ))
}

function findGainMargin(loop: BodePoint[]) {
  for (let i = 1; i < loop.length; i += 1) {
    const prevPhase = loop[i - 1].phase_deg
    const nextPhase = loop[i].phase_deg
    if ((prevPhase >= -180 && nextPhase <= -180) || (prevPhase <= -180 && nextPhase >= -180)) {
      const freq = interpolate(loop[i - 1].phase_deg, loop[i - 1].freq_hz, loop[i].phase_deg, loop[i].freq_hz, -180)
      const mag = interpolate(loop[i - 1].freq_hz, loop[i - 1].magnitude_db, loop[i].freq_hz, loop[i].magnitude_db, freq)
      return { freq, magnitude_db: mag }
    }
  }
  return null
}

// ── Plant models ──────────────────────────────────────────────────────────────

/**
 * Voltage-mode buck plant (control-to-output, duty-cycle modulator = Vin).
 * Double LC pole + ESR zero.
 * Erickson & Maksimovic §8.1 — buck converter averaged model
 */
function voltageModePolynomials(spec: DesignSpec, L: number, C: number, Esr: number, Rload: number) {
  // Gvd_vm(s) = Vin × (1 + s·ESR·C) / (s²·L·C + s·(ESR·C + L/Rload) + 1)
  const numerator   = [spec.vinMax * Esr * C, spec.vinMax] as const
  const denominator = [L * C, Esr * C + L / Rload, 1] as const
  const w0 = 1 / Math.sqrt(L * C)
  const z0 = w0                        // compensator zero: cancel LC resonance
  const p0 = 1 / (Esr * C)            // compensator pole: at ESR zero
  return { numerator, denominator, z0, p0 }
}

/**
 * Peak current-mode buck plant (single-pole, inductor dynamics absorbed by inner loop).
 * Ridley, "A New Continuous-Time Model for Current-Mode Control" (1991)
 * Simplified single-pole approximation below fsw/2:
 *   Gvd_cm(s) = Rload × (1 + s/ωz_esr) / (1 + s/ωp)
 */
function currentModePolynomials(C: number, Esr: number, Rload: number, fsw: number) {
  // Single output pole ωp = 1/(Rload·C); ESR zero ωz = 1/(ESR·C)
  const numerator   = [Rload * Esr * C, Rload] as const
  const denominator = [Rload * C, 1] as const
  const z0 = 1 / (Rload * C)                                   // zero: cancel output pole
  const p0 = Math.min(1 / (Esr * C), 2 * Math.PI * fsw / 5)   // pole: at ESR zero or fsw/5
  return { numerator, denominator, z0, p0 }
}

// ── Slope compensation ────────────────────────────────────────────────────────

/**
 * Minimum slope compensation for D > 0.5 in peak current mode.
 * Erickson & Maksimovic §11.3, eq. 11.21:
 *   Se_min = Vout / (2 × L)   [A/s, normalised — multiply by Rsense for V/s]
 */
function computeSlopeCompensation(spec: DesignSpec, result: DesignResult): SlopeCompensation {
  const subharmonic_risk = result.dutyCycle > 0.5
  const se_required_aps = spec.vout / (2 * result.inductance)
  return { se_required_aps, subharmonic_risk }
}

// ── Main analysis function ────────────────────────────────────────────────────

export function analyzeBuckControlLoop(
  spec: DesignSpec,
  result: DesignResult,
  options?: {
    esr?: number
    targetCrossoverHz?: number
    targetPhaseMarginDeg?: number
    controlMode?: ControlMode
  },
): ControlLoopAnalysis {
  const L    = result.inductance
  const C    = result.capacitance
  const Esr  = options?.esr ?? 0.05
  const Rload = spec.vout / spec.iout
  const controlMode: ControlMode = options?.controlMode ?? spec.controlMode ?? 'voltage'
  const targetCrossoverHz  = options?.targetCrossoverHz  ?? spec.fsw / 10
  const desiredPhaseMargin = options?.targetPhaseMarginDeg ?? 60

  // Select plant model and compensator zero/pole based on control mode
  const { numerator: plantNum, denominator: plantDen, z0, p0 } =
    controlMode === 'current'
      ? currentModePolynomials(C, Esr, Rload, spec.fsw)
      : voltageModePolynomials(spec, L, C, Esr, Rload)

  const normCompNumerator   = [1, z0] as const
  const normCompDenominator = [1 / p0, 1, 0] as const

  // Sweep frequencies to find design point closest to desired phase margin
  const candidateFreqs = logspace(10, Math.min(spec.fsw * 10, targetCrossoverHz * 2), 800)
  const designCandidate = candidateFreqs.reduce(
    (best, freq) => {
      const plantPhase = evaluateTransferFunction(plantNum, plantDen, freq).phase_deg
      const compPhase  = evaluateTransferFunction(normCompNumerator, normCompDenominator, freq).phase_deg
      const phaseMargin = 180 + normalizePhase(plantPhase + compPhase)
      const error       = Math.abs(phaseMargin - desiredPhaseMargin)
      const targetError = Math.abs(best.phaseMargin - desiredPhaseMargin)
      if (error < targetError) return { freq, phaseMargin }
      if (error === targetError && Math.abs(freq - targetCrossoverHz) < Math.abs(best.freq - targetCrossoverHz)) {
        return { freq, phaseMargin }
      }
      return best
    },
    {
      freq: targetCrossoverHz,
      phaseMargin:
        180 + normalizePhase(
          evaluateTransferFunction(plantNum, plantDen, targetCrossoverHz).phase_deg +
          evaluateTransferFunction(normCompNumerator, normCompDenominator, targetCrossoverHz).phase_deg,
        ),
    },
  )

  // Scale compensator gain so loop gain = 0 dB at design frequency
  const designFreq       = designCandidate.freq
  const plantAtDesign    = evaluateTransferFunction(plantNum, plantDen, designFreq)
  const compNormAtDesign = evaluateTransferFunction(normCompNumerator, normCompDenominator, designFreq)
  const linearGain       = 1 / (10 ** (plantAtDesign.magnitude_db / 20) * 10 ** (compNormAtDesign.magnitude_db / 20))
  const compensatorNumerator   = [linearGain, linearGain * z0] as const
  const compensatorDenominator = [1 / p0, 1, 0] as const

  const freqs = logspace(10, spec.fsw * 10, 500)
  const plant = freqs.map((freq) => ({
    freq_hz: freq,
    ...evaluateTransferFunction(plantNum, plantDen, freq),
  }))
  const compensator = freqs.map((freq) => ({
    freq_hz: freq,
    ...evaluateTransferFunction(compensatorNumerator, compensatorDenominator, freq),
  }))
  const loop = freqs.map((freq) => {
    const pv = evaluateTransferFunction(plantNum, plantDen, freq)
    const cv = evaluateTransferFunction(compensatorNumerator, compensatorDenominator, freq)
    return {
      freq_hz: freq,
      magnitude_db: pv.magnitude_db + cv.magnitude_db,
      phase_deg: normalizePhase(pv.phase_deg + cv.phase_deg),
    }
  })

  const crossover = findCrossoverPoint(loop, designFreq)
  const gainPoint = findGainMargin(loop)
  const crossoverFrequencyHz = crossover?.freq ?? NaN
  const phaseMarginDeg       = crossover ? 180 + crossover.phase : NaN
  const gainMarginDb         = gainPoint ? -gainPoint.magnitude_db : NaN

  const slopeCompensation = computeSlopeCompensation(spec, result)

  const warnings: string[] = []

  if (controlMode === 'current' && slopeCompensation.subharmonic_risk) {
    // Erickson & Maksimovic §11.3 — subharmonic oscillation condition
    warnings.push(
      `D = ${(result.dutyCycle * 100).toFixed(0)} % > 50 % — current-mode control requires slope compensation. ` +
      `Without it the converter will exhibit subharmonic oscillation at fsw/2. ` +
      `Add an external ramp Se ≥ ${(slopeCompensation.se_required_aps / 1e6).toFixed(1)} MA/s × Rsense.`,
    )
  }
  if (!Number.isNaN(phaseMarginDeg) && phaseMarginDeg < 45) {
    warnings.push('Phase margin is below 45° — unstable or marginal control loop')
  }
  if (!Number.isNaN(gainMarginDb) && gainMarginDb < 6) {
    warnings.push('Gain margin is below 6 dB — poor stability reserve')
  }
  if (!Number.isNaN(crossoverFrequencyHz) && crossoverFrequencyHz > spec.fsw / 5) {
    warnings.push('Crossover frequency exceeds fsw/5 — may violate switching dynamics')
  }

  return {
    frequency_hz: freqs,
    plant,
    compensator,
    loop,
    designFrequencyHz: designFreq,
    crossoverFrequencyHz,
    phaseMarginDeg,
    gainMarginDb,
    warnings,
    controlMode,
    slopeCompensation,
  }
}
