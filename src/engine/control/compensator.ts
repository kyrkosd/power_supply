// Compensator design: search for the design frequency that yields target phase margin,
// then scale gain so loop magnitude crosses 0 dB at that frequency.

import type { DesignSpec } from '../types'
import { evaluateTransferFunction, normalizePhase, logspace } from './tf-math'

export function findDesignFrequency(
  plantNum: readonly number[], plantDen: readonly number[],
  normCompNum: readonly number[], normCompDen: readonly number[],
  targetCrossoverHz: number, desiredPhaseMargin: number, spec: DesignSpec,
): number {
  const fMax = Math.min(spec.fsw * 10, targetCrossoverHz * 2)
  const candidateFreqs = logspace(10, fMax, 800)

  function pmAt(f: number): number {
    const plant = evaluateTransferFunction(plantNum, plantDen, f).phase_deg
    const comp  = evaluateTransferFunction(normCompNum, normCompDen, f).phase_deg
    return 180 + normalizePhase(plant + comp)
  }

  const init = { freq: targetCrossoverHz, phaseMargin: pmAt(targetCrossoverHz) }
  return candidateFreqs.reduce((best, freq) => {
    const phaseMargin = pmAt(freq)
    const err    = Math.abs(phaseMargin - desiredPhaseMargin)
    const bestErr = Math.abs(best.phaseMargin - desiredPhaseMargin)
    if (err < bestErr) return { freq, phaseMargin }
    if (err === bestErr && Math.abs(freq - targetCrossoverHz) < Math.abs(best.freq - targetCrossoverHz))
      return { freq, phaseMargin }
    return best
  }, init).freq
}

export interface CompensatorCoeffs {
  compensatorNumerator:   readonly number[]
  compensatorDenominator: readonly number[]
}

/** Scale compensator gain so loop magnitude = 0 dB at the design frequency. */
export function scaleCompensatorGain(
  plantNum: readonly number[], plantDen: readonly number[],
  normCompNum: readonly number[], normCompDen: readonly number[],
  designFreq: number, z0: number, p0: number,
): CompensatorCoeffs {
  const plantAtDesign    = evaluateTransferFunction(plantNum, plantDen, designFreq)
  const compNormAtDesign = evaluateTransferFunction(normCompNum, normCompDen, designFreq)
  const linearGain       = 1 / (10 ** (plantAtDesign.magnitude_db / 20) * 10 ** (compNormAtDesign.magnitude_db / 20))
  return {
    compensatorNumerator:   [linearGain, linearGain * z0],
    compensatorDenominator: [1 / p0, 1, 0],
  }
}
