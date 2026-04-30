import { complex, abs, arg, add, multiply, divide } from 'mathjs'
import type { DesignSpec, DesignResult } from './types'

export interface BodePoint {
  freq_hz: number
  magnitude_db: number
  phase_deg: number
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
    magnitude_db: 20 * Math.log10(abs(h)),
    phase_deg: arg(h) * RAD_TO_DEG,
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

export function analyzeBuckControlLoop(
  spec: DesignSpec,
  result: DesignResult,
  options?: { esr?: number; targetCrossoverHz?: number; targetPhaseMarginDeg?: number },
): ControlLoopAnalysis {
  const L = result.inductance
  const C = result.capacitance
  const Esr = options?.esr ?? 0.05
  const Rload = spec.vout / spec.iout
  const w0 = 1 / Math.sqrt(L * C)
  const z0 = w0
  const p0 = 1 / (Esr * C)
  const targetCrossoverHz = options?.targetCrossoverHz ?? spec.fsw / 10

  const plantNumerator = [spec.vinMax * Esr * C, spec.vinMax]
  const plantDenominator = [L * C, Esr * C + L / Rload, 1]

  const normCompNumerator = [1, z0]
  const normCompDenominator = [1 / p0, 1, 0]
  const desiredPhaseMargin = options?.targetPhaseMarginDeg ?? 60

  const candidateFreqs = logspace(10, Math.min(spec.fsw * 10, targetCrossoverHz * 2), 800)
  const designCandidate = candidateFreqs.reduce(
    (best, freq) => {
      const plantPhase = evaluateTransferFunction(plantNumerator, plantDenominator, freq).phase_deg
      const compPhase = evaluateTransferFunction(normCompNumerator, normCompDenominator, freq).phase_deg
      const phaseMargin = 180 + normalizePhase(plantPhase + compPhase)
      const error = Math.abs(phaseMargin - desiredPhaseMargin)
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
          evaluateTransferFunction(plantNumerator, plantDenominator, targetCrossoverHz).phase_deg +
            evaluateTransferFunction(normCompNumerator, normCompDenominator, targetCrossoverHz).phase_deg,
        ),
    },
  )

  const designFreq = designCandidate.freq
  const plantAtDesign = evaluateTransferFunction(plantNumerator, plantDenominator, designFreq)
  const compNormAtDesign = evaluateTransferFunction(normCompNumerator, normCompDenominator, designFreq)
  const linearGain = 1 / (Math.pow(10, plantAtDesign.magnitude_db / 20) * Math.pow(10, compNormAtDesign.magnitude_db / 20))
  const compensatorNumerator = [linearGain, linearGain * z0]
  const compensatorDenominator = [1 / p0, 1, 0]
  const freqs = logspace(10, spec.fsw * 10, 500)
  const plant = freqs.map((freq) => ({ freq_hz: freq, ...evaluateTransferFunction(plantNumerator, plantDenominator, freq) }))
  const compensator = freqs.map((freq) => ({ freq_hz: freq, ...evaluateTransferFunction(compensatorNumerator, compensatorDenominator, freq) }))
  const loop = freqs.map((freq) => {
    const plantValue = evaluateTransferFunction(plantNumerator, plantDenominator, freq)
    const compValue = evaluateTransferFunction(compensatorNumerator, compensatorDenominator, freq)
    return {
      freq_hz: freq,
      magnitude_db: plantValue.magnitude_db + compValue.magnitude_db,
      phase_deg: normalizePhase(plantValue.phase_deg + compValue.phase_deg),
    }
  })

  const crossover = findCrossoverPoint(loop, designFreq)
  const gainPoint = findGainMargin(loop)
  const crossoverFrequencyHz = crossover?.freq ?? NaN
  const phaseMarginDeg = crossover ? 180 + crossover.phase : NaN
  const gainMarginDb = gainPoint ? -gainPoint.magnitude_db : NaN

  const warnings: string[] = []
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
  }
}
