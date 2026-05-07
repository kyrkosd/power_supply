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

export function buildLosses(
  mosfet_conduction: number,
  mosfet_switching: number,
  mosfet_gate: number,
  inductor_copper: number,
  inductor_core: number,
  diode_conduction: number,
  sync_conduction: number,
  sync_dead_time: number,
  capacitor_esr: number,
): PowerConverterLosses {
  const total = mosfet_conduction + mosfet_switching + mosfet_gate +
                inductor_copper + inductor_core + diode_conduction +
                sync_conduction + sync_dead_time + capacitor_esr
  return {
    mosfet_conduction,
    mosfet_switching,
    mosfet_gate,
    inductor_copper,
    inductor_core,
    diode_conduction,
    sync_conduction,
    sync_dead_time,
    capacitor_esr,
    total,
  }
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
    dutyCycle: params.dutyCycle,
    inductance: params.inductance,
    capacitance: params.capacitance,
    peakCurrent: params.peakCurrent,
    efficiency: params.efficiency,
    ccm_dcm_boundary: params.ccm_dcm_boundary,
    operating_mode: params.operating_mode,
    saturation_check: params.saturation_check,
    losses: params.losses,
    warnings: params.warnings,
    ...params.extra,
  }
}
