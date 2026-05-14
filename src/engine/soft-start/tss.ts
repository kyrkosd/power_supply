import type { DesignSpec, DesignResult } from '../types'

export const ISOLATED_TOPOLOGIES = new Set(['flyback', 'forward'])

// TI SLVA801 §3 — ten output time constants; clamped to [1 ms, 50 ms].
export function computeRecommendedTss(result: DesignResult, spec: DesignSpec): number {
  return Math.max(0.001, Math.min(0.050,
    (result.capacitance * spec.vout * 10) / spec.iout,
  ))
}
