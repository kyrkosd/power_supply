import type { DesignSpec } from '../topologies/types'
import type { EMIDesignResult } from './harmonic'

export interface EmiParams { fsw: number; D: number; Ipeak: number; tr: number }

export function extractEmiParams(spec: DesignSpec, result: EMIDesignResult): EmiParams {
  return {
    fsw:   spec.fsw ?? 200000,
    D:     result.dutyCycle ?? result.duty_cycle ?? 0.5,
    Ipeak: result.peakCurrent ?? result.inductor?.peak_current ?? spec.iout_max ?? 1,
    tr:    20e-9,
  }
}
