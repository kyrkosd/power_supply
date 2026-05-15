import type { DesignSpec, TransientMode } from '../topologies/types'

export interface ModeStepResult { vin: number; iout: number; changed: boolean }

export function applyModeTransition(
  t: number,
  mode: TransientMode,
  spec: DesignSpec,
  vin: number,
  iout: number,
): ModeStepResult {
  if (t < 0.002) return { vin, iout, changed: false }
  if (mode === 'load-step' && iout !== spec.iout) return { vin, iout: spec.iout, changed: true }
  if (mode === 'line-step' && vin !== spec.vinMax)  return { vin: spec.vinMax, iout, changed: true }
  return { vin, iout, changed: false }
}
