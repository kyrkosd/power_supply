import type { DesignSpec, DesignResult } from '../topologies/types'
import type { TransientMode } from '../topologies/types'

export function initSimState(
  mode: TransientMode,
  spec: DesignSpec,
  result: DesignResult,
): { x: [number, number]; current_vin: number; current_iout: number; current_duty: number } {
  const vin_nom = (spec.vinMin + spec.vinMax) / 2
  let current_vin  = vin_nom
  let current_iout = spec.iout
  let x: [number, number] = [0, 0]

  if (mode === 'load-step' || mode === 'line-step') {
    current_iout = mode === 'load-step' ? spec.iout * 0.5 : spec.iout
    current_vin  = mode === 'line-step' ? spec.vinMin : vin_nom
    x = [current_iout, spec.vout]
  }

  return { x, current_vin, current_iout, current_duty: mode === 'startup' ? 0 : (result.dutyCycle || 0.5) }
}

export function computeVref(
  mode: TransientMode,
  t: number,
  softStartSeconds: number | undefined,
  vout: number,
): number {
  if (mode !== 'startup') return vout
  const softStartEnd = softStartSeconds ?? 0.002
  return t < softStartEnd ? vout * (t / softStartEnd) : vout
}
