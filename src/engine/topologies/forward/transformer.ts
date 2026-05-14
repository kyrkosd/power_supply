import type { DesignSpec } from '../../types'
import { selectCore } from '../core-selector'
import type { CoreData } from '../core-selector'

export interface ForwardTransformer {
  turnsRatio:            number          // Np/Ns
  primaryTurns:          number          // integer
  secondaryTurns:        number          // integer
  magnetizingInductance: number          // H
  selectedCore:          CoreData | null
  lmMin:                 number          // H
  deltaIm_target:        number          // A
}

// Transformer design for a single-switch forward converter.
// Turns ratio: N = (Vin_min × D_max) / Vout — Erickson 3rd ed., Table 6-1.
// Primary turns from both flux-density and inductance constraints; larger wins.
// Core area-product method; Bmax = 0.3 T, J = 400 kA/m², ku = 0.4.
export function computeTransformer(spec: DesignSpec, dMax: number, primaryCurrentAvg: number): ForwardTransformer {
  const { vinMin, vout, fsw } = spec
  const turnsRatio      = (vinMin * dMax) / vout
  const deltaIm_target  = 0.2 * primaryCurrentAvg

  // Lm ≥ Vin_min·D_max / (fsw·ΔIm_target) — Erickson §6.2.1
  const lmMin       = (vinMin * dMax) / (fsw * deltaIm_target)
  const bMax = 0.3, j = 400_000, ku = 0.4
  const areaProduct = (lmMin * primaryCurrentAvg * (deltaIm_target / 2)) / (bMax * j * ku)
  const selectedCore = selectCore(areaProduct)

  const npFromFlux = selectedCore ? Math.ceil((vinMin * dMax) / (bMax * selectedCore.Ae * fsw)) : 10
  const npFromLm   = selectedCore ? Math.ceil(Math.sqrt(lmMin / (selectedCore.AL * 1e-9))) : 10
  const primaryTurns    = Math.max(npFromFlux, npFromLm)
  const secondaryTurns  = Math.max(1, Math.round(primaryTurns / turnsRatio))
  const magnetizingInductance = selectedCore
    ? (selectedCore.AL * 1e-9) * primaryTurns ** 2
    : lmMin

  return { turnsRatio, primaryTurns, secondaryTurns, magnetizingInductance, selectedCore, lmMin, deltaIm_target }
}
