// Evaluate plant, compensator, and loop Bode data at 500 log-spaced frequencies.

import type { DesignSpec } from '../types'
import { evaluateTransferFunction, normalizePhase, logspace, type BodePoint } from './tf-math'

export interface BodeArrays {
  freqs:       number[]
  plant:       BodePoint[]
  compensator: BodePoint[]
  loop:        BodePoint[]
}

export function computeBodeArrays(
  plantNum: readonly number[], plantDen: readonly number[],
  compensatorNum: readonly number[], compensatorDen: readonly number[],
  spec: DesignSpec,
): BodeArrays {
  const freqs = logspace(10, spec.fsw * 10, 500)
  const plant       = freqs.map((f) => ({ freq_hz: f, ...evaluateTransferFunction(plantNum, plantDen, f) }))
  const compensator = freqs.map((f) => ({ freq_hz: f, ...evaluateTransferFunction(compensatorNum, compensatorDen, f) }))
  const loop = freqs.map((f) => {
    const p = evaluateTransferFunction(plantNum, plantDen, f)
    const c = evaluateTransferFunction(compensatorNum, compensatorDen, f)
    return {
      freq_hz:      f,
      magnitude_db: p.magnitude_db + c.magnitude_db,
      phase_deg:    normalizePhase(p.phase_deg + c.phase_deg),
    }
  })
  return { freqs, plant, compensator, loop }
}
