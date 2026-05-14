// Buck (step-down) converter — steady-state design with optional N-phase interleaving.
// Assumes CCM (Continuous Conduction Mode) and ideal switch/diode unless rectification='synchronous'.
//
// Sub-modules:
//   buck/phase.ts        — per-phase L/C and ripple-cancellation factor (Erickson §12.3)
//   buck/losses.ts       — MOSFET / diode / inductor / capacitor loss breakdown
//   buck/warnings.ts     — multi-phase ripple-ratio and current-sharing warnings
//   buck/waveforms.ts    — time-domain inductor current / switch node / Vout ripple
//   buck/state-space.ts  — averaged state-space model for the transient solver

import type { DesignSpec, DesignResult, Topology } from '../types'
import { analyzeBuckControlLoop } from '../control-loop'
import { checkSaturation } from '../inductor-saturation'
import { buildDesignResult, detectCcmDcm, calcEfficiency } from './result-utils'
import { computePhaseValues } from './buck/phase'
import { computeBuckLosses, sumLosses } from './buck/losses'
import { multiphaseWarnings } from './buck/warnings'
import { generateBuckWaveforms } from './buck/waveforms'
import { buckStateSpace } from './buck/state-space'

function clampPhases(phases: number | undefined): number {
  return Math.max(1, Math.min(6, Math.round(phases ?? 1)))
}

function buckDuty(spec: DesignSpec): number {
  return Math.min(Math.max(spec.vout / spec.vinMax, 0.01), 0.99)
}

function multiPhaseExtra(N: number, L_phase: number, peak_phase: number, K_out: number): Partial<DesignResult> {
  if (N <= 1) return {}
  return {
    phases:               N,
    phase_inductance:     L_phase,
    phase_peak_current:   peak_phase,
    output_ripple_cancel: K_out,
    input_ripple_cancel:  1 / N,
  }
}

function computeBuck(spec: DesignSpec): DesignResult {
  const { vout, iout } = spec
  const N         = clampPhases(spec.phases)
  const dutyCycle = buckDuty(spec)
  const phase     = computePhaseValues(spec, dutyCycle, N)
  const { L_phase, deltaIL_phase, I_phase_avg, peak_phase, C_single, C_multi, K_out } = phase

  const ccm_dcm_boundary = deltaIL_phase / 2
  const { operating_mode, warnings } = detectCcmDcm(I_phase_avg, ccm_dcm_boundary)
  if (N > 1) warnings.push(...multiphaseWarnings(N, K_out, deltaIL_phase, I_phase_avg))

  const loop = analyzeBuckControlLoop(spec, {
    dutyCycle, inductance: L_phase, capacitance: N === 1 ? C_single : C_multi,
    peakCurrent: peak_phase, warnings: [],
  })
  const saturation_check = checkSaturation(peak_phase, I_phase_avg)
  if (saturation_check.warning) warnings.push(saturation_check.warning)

  const losses     = computeBuckLosses(spec, { dutyCycle, N, I_phase_avg, peak_phase, deltaIL_phase, K_out })
  const efficiency = calcEfficiency(vout * iout, sumLosses(losses))

  return buildDesignResult({
    dutyCycle,
    inductance:  L_phase,
    capacitance: N === 1 ? C_single : C_multi,
    peakCurrent: peak_phase,
    efficiency,
    ccm_dcm_boundary,
    operating_mode,
    saturation_check,
    losses,
    warnings: [...warnings, ...loop.warnings],
    extra:    multiPhaseExtra(N, L_phase, peak_phase, K_out),
  })
}

export const buckTopology: Topology = {
  id:   'buck',
  name: 'Buck (Step-Down)',
  compute:           computeBuck,
  generateWaveforms: generateBuckWaveforms,
  getStateSpaceModel: buckStateSpace,
}
