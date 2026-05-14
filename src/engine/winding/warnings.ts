// Winding-health warnings: fill factor, proximity factor, leakage inductance, total copper loss.

import type { DesignSpec, DesignResult } from '../types'
import { MAX_FILL } from './awg'

function fillWarning(fillRatio: number): string | null {
  if (fillRatio > MAX_FILL) return `Bobbin fill ${(fillRatio * 100).toFixed(0)} % exceeds 60 %. Consider a larger core or fewer parallel strands.`
  if (fillRatio > 0.70)     return `Tight winding window: fill = ${(fillRatio * 100).toFixed(0)} %. Consider a larger core or thinner wire.`
  return null
}

function proximityWarning(Fr: number): string | null {
  if (Fr <= 2) return null
  return `Significant AC winding loss: proximity factor Fr = ${Fr.toFixed(2)}. Reduce layers by using more parallel thin strands or litz wire.`
}

function leakageWarning(estimated_leakage_nh: number, result: DesignResult): string | null {
  const LmNh = (result.magnetizingInductance ?? result.inductance) * 1e9
  if (LmNh <= 0 || estimated_leakage_nh <= 0.05 * LmNh) return null
  return `Estimated leakage ${estimated_leakage_nh.toFixed(0)} nH is > 5 % of Lm. Consider interleaved winding to reduce leakage.`
}

function copperLossWarning(total_copper_loss: number, spec: DesignSpec): string | null {
  const Pout = spec.vout * spec.iout
  if (total_copper_loss <= 0.05 * Pout) return null
  return `Total winding copper loss ${(total_copper_loss * 1000).toFixed(0)} mW exceeds 5 % of Pout (${(Pout * 1000).toFixed(0)} mW).`
}

export function buildWindingWarnings(
  fillRatio: number, Fr: number, estimated_leakage_nh: number,
  result: DesignResult, spec: DesignSpec, total_copper_loss: number,
): string[] {
  const warnings: string[] = []
  const checks = [
    fillWarning(fillRatio),
    proximityWarning(Fr),
    leakageWarning(estimated_leakage_nh, result),
    copperLossWarning(total_copper_loss, spec),
  ]
  for (const w of checks) if (w) warnings.push(w)
  return warnings
}
