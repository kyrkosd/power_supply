// Current sense element design for peak current-mode control (PCM).
//
// References:
//   TI SLVA452B  — Current-Sensing Techniques in Buck Converters
//   TI SLVA101   — Slope Compensation / Current-Mode Stability
//   Ridley Engineering, "A New Small-Signal Model for Current-Mode Control" (1991)
//   Infineon AN_1805_PL52_1803_132890 — Rds(on) sensing accuracy vs. temperature
//   Vishay VYMC  — Kelvin sensing requirements for low-value current-sense resistors
import type { DesignSpec, DesignResult } from './types'
import type { SenseMethod, CurrentSenseResult } from './current-sense/types'
import { triangularRms } from './current-sense/common'
import { designResistorSense } from './current-sense/resistor'
import { designRdsonSense } from './current-sense/rdson'

export type { SenseMethod, CurrentSenseResult }

// Called by: worker/compute.ts (applyCurrentSense), guarded by spec.controlMode === 'current'
// Why: sizing the sense element requires peakCurrent and dutyCycle from the base result,
// so this runs as a post-compute step in the worker rather than inside the topology engine.
// The _topology parameter is accepted for future topology-specific sense methods (e.g.,
// a flyback primary-side sense that uses a different peak-current formula).
export function designCurrentSense(
  _topology: string,
  spec: DesignSpec,
  result: DesignResult,
  method: SenseMethod,
  vsenseTargetMv = 150,
): CurrentSenseResult {
  const warnings: string[] = []
  const deltaIL       = 2 * Math.max(result.peakCurrent - spec.iout, 0)
  const ilRmsValue    = triangularRms(spec.iout, deltaIL)
  const iL_peak_light = Math.max(0.1 * spec.iout + deltaIL / 2, 1e-6)

  return method === 'resistor'
    ? designResistorSense(spec, result, deltaIL, ilRmsValue, iL_peak_light, vsenseTargetMv, warnings)
    : designRdsonSense(spec, result, deltaIL, iL_peak_light, warnings)
}
