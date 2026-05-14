// Slope compensation for peak current-mode buck.
// Erickson & Maksimovic §11.3, eq. 11.21: Se_min = Vout / (2 × L).

import type { DesignSpec, DesignResult } from '../types'

/**
 * Slope compensation data for peak current-mode control.
 */
export interface SlopeCompensation {
  /** Minimum external ramp slope to prevent subharmonic oscillation, in A/s.
   *  (Normalised — multiply by your Rsense in Ω to get V/s.) */
  se_required_aps: number
  /** True when D > 0.5 and no slope compensation is applied. */
  subharmonic_risk: boolean
}

export function computeSlopeCompensation(spec: DesignSpec, result: DesignResult): SlopeCompensation {
  return {
    se_required_aps:  spec.vout / (2 * result.inductance),
    subharmonic_risk: result.dutyCycle > 0.5,
  }
}
