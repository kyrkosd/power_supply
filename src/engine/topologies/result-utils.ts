import type { DesignResult } from '../types'
import type { SaturationResult } from '../inductor-saturation'

export interface PowerConverterLosses {
  mosfet_conduction: number
  mosfet_switching: number
  mosfet_gate: number
  inductor_copper: number
  inductor_core: number
  diode_conduction: number
  sync_conduction: number
  sync_dead_time: number
  capacitor_esr: number
  total: number
}

// Named-object signature eliminates argument-order bugs at all four call sites.
export function buildLosses(
  inputs: Omit<PowerConverterLosses, 'total'>,
): PowerConverterLosses {
  const total =
    inputs.mosfet_conduction + inputs.mosfet_switching + inputs.mosfet_gate +
    inputs.inductor_copper   + inputs.inductor_core    + inputs.diode_conduction +
    inputs.sync_conduction   + inputs.sync_dead_time   + inputs.capacitor_esr
  return { ...inputs, total }
}

// Shared across boost, buckBoost — previously duplicated in each file.
export function normalizeDuty(duty: number): number {
  return Math.min(Math.max(duty, 0.01), 0.99)
}

// CCM/DCM detection logic is identical in buck, boost, buckBoost, sepic.
export function detectCcmDcm(
  loadCurrent: number,
  boundary: number,
): { operating_mode: 'CCM' | 'DCM' | 'boundary'; warnings: string[] } {
  if (loadCurrent > 1.2 * boundary) {
    return { operating_mode: 'CCM', warnings: [] }
  }
  if (loadCurrent < boundary) {
    return {
      operating_mode: 'DCM',
      warnings: ['Operating in DCM. Equations assume CCM — results may be inaccurate. Increase inductance or load current to enter CCM.'],
    }
  }
  return {
    operating_mode: 'boundary',
    warnings: ['Near CCM/DCM boundary. Performance may be unpredictable at light loads.'],
  }
}

export function calcEfficiency(pout: number, totalLoss: number): number {
  return pout <= 0 ? 0 : pout / (pout + totalLoss)
}

export function buildDesignResult(params: {
  dutyCycle: number
  inductance: number
  capacitance: number
  peakCurrent: number
  efficiency: number
  ccm_dcm_boundary: number
  operating_mode: 'CCM' | 'DCM' | 'boundary'
  saturation_check: SaturationResult
  losses: PowerConverterLosses
  warnings: string[]
  extra?: Partial<DesignResult>
}): DesignResult {
  return {
    dutyCycle:         params.dutyCycle,
    inductance:        params.inductance,
    capacitance:       params.capacitance,
    peakCurrent:       params.peakCurrent,
    efficiency:        params.efficiency,
    ccm_dcm_boundary:  params.ccm_dcm_boundary,
    operating_mode:    params.operating_mode,
    saturation_check:  params.saturation_check,
    losses:            params.losses,
    warnings:          params.warnings,
    ...params.extra,
  }
}
