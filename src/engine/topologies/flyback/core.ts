import { selectCore } from '../core-selector'
import type { CoreData } from '../core-selector'

export interface FlybackCoreResult {
  selectedCore:   CoreData
  primaryTurns:   number
  secondaryTurns: number
}

// Area-product method: AP ≥ Lm × Ip_peak × Ip_avg / (Bmax × J × ku).
// Bmax = 0.3 T (ferrite), J = 400 kA/m², ku = 0.4.
export function computeCoreAndTurns(
  Lm: number,
  primaryPeakCurrent: number,
  primaryCurrentAvg: number,
  turnsRatio: number,
): FlybackCoreResult | null {
  const bMax = 0.3, j = 400_000, ku = 0.4
  const areaProduct = (Lm * primaryPeakCurrent * primaryCurrentAvg) / (bMax * j * ku)
  const core = selectCore(areaProduct)
  if (!core) return null

  const primaryTurns   = Math.ceil(Lm * primaryPeakCurrent / (bMax * core.Ae))
  const secondaryTurns = Math.ceil(primaryTurns / turnsRatio)
  return { selectedCore: core, primaryTurns, secondaryTurns }
}
