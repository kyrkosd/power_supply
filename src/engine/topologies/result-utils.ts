import type { DesignResult } from '../types'
import type { SaturationResult } from '../inductor-saturation'

// ── Types ─────────────────────────────────────────────────────────────────────

/** All loss components in a switching power converter, in watts. */
export interface PowerConverterLosses {
  mosfet_conduction: number
  mosfet_switching:  number
  mosfet_gate:       number
  inductor_copper:   number
  inductor_core:     number
  diode_conduction:  number
  sync_conduction:   number
  sync_dead_time:    number
  capacitor_esr:     number
  total:             number
}

// ── Loss helpers ──────────────────────────────────────────────────────────────

/**
 * Sum all component losses and return the full `PowerConverterLosses` object.
 * Named-object signature eliminates argument-order bugs at all call sites.
 */
export function buildLosses(
  inputs: Omit<PowerConverterLosses, 'total'>,
): PowerConverterLosses {
  const total =
    inputs.mosfet_conduction + inputs.mosfet_switching + inputs.mosfet_gate +
    inputs.inductor_copper   + inputs.inductor_core    + inputs.diode_conduction +
    inputs.sync_conduction   + inputs.sync_dead_time   + inputs.capacitor_esr
  return { ...inputs, total }
}

/** Clamp duty cycle to [0.01, 0.99] to avoid degenerate boundary conditions. */
export function normalizeDuty(duty: number): number {
  return Math.min(Math.max(duty, 0.01), 0.99)
}

/**
 * Classify CCM vs DCM vs boundary based on load current vs critical boundary.
 * Shared by buck, boost, buck-boost, forward, and SEPIC topologies.
 */
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

/** η = Pout / (Pout + P_loss). Returns 0 when Pout ≤ 0. */
export function calcEfficiency(pout: number, totalLoss: number): number {
  return pout <= 0 ? 0 : pout / (pout + totalLoss)
}

/**
 * Construct a `DesignResult` from the standard set of computed sub-sections.
 * Pass topology-specific extra fields (e.g. `phases`, `turnsRatio`) via `extra`.
 */
export function buildDesignResult(params: {
  dutyCycle:         number
  inductance:        number
  capacitance:       number
  peakCurrent:       number
  efficiency:        number
  ccm_dcm_boundary:  number
  operating_mode:    'CCM' | 'DCM' | 'boundary'
  saturation_check:  SaturationResult
  losses:            Omit<PowerConverterLosses, 'total'>
  warnings:          string[]
  extra?:            Partial<DesignResult>
}): DesignResult {
  return {
    dutyCycle:        params.dutyCycle,
    inductance:       params.inductance,
    capacitance:      params.capacitance,
    peakCurrent:      params.peakCurrent,
    efficiency:       params.efficiency,
    ccm_dcm_boundary: params.ccm_dcm_boundary,
    operating_mode:   params.operating_mode,
    saturation_check: params.saturation_check,
    losses:           buildLosses(params.losses),
    warnings:         params.warnings,
    ...params.extra,
  }
}
