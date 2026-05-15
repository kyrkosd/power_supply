// Input EMI filter designer for switching power supplies.
//
// References:
//   Middlebrook, R.D. "Input Filter Considerations in Design and Application of
//     Switching Regulators" IEEE IAS 1976 — negative impedance stability criterion
//   TI SLYT636 — EMI Filter Design for Power Electronics
//   Erickson & Maksimovic §10.1 — Filter Design / Damping
//   IEC 60384-14 — X and Y capacitor safety classes
//   Würth Elektronik ANP008e — Common-mode choke design guidelines

import type { DesignSpec, DesignResult, FilterComponent, InputFilterResult } from './types'
import type { EMIResult } from './topologies/types'

export type { FilterComponent, InputFilterResult }
export type { InputFilterOptions } from './input-filter/types'

export const DEFAULT_INPUT_FILTER_OPTIONS = {
  enabled: false,
  attenuation_override_db: 0,
  cm_choke_h: 0,
} as const

import { computeDmFilter, computeDampingNetwork } from './input-filter/dm-stage'
import { computeMiddlebrook } from './input-filter/stability'
import { computeCmFilter } from './input-filter/cm-stage'
import { buildFilterComponents } from './input-filter/components'
import { resolveAttenuationTarget, buildFilterWarnings } from './input-filter/warnings'
export { filterOutputImpedance, converterInputImpedance } from './input-filter/impedance'

import type { InputFilterOptions } from './input-filter/types'

// Called by: worker/compute.ts (applyInputFilter), guarded by spec.inputFilterEnabled
// Why: filter design needs the EMI result (to derive the required attenuation target), which
// is itself produced earlier in the same optional-analyses chain. Running sequentially in the
// worker keeps the design data consistent — both EMI and filter use the same result snapshot.
export function designInputFilter(
  _topology: string,
  spec: DesignSpec,
  result: DesignResult,
  emi: EMIResult,
  opts: InputFilterOptions = DEFAULT_INPUT_FILTER_OPTIONS,
): InputFilterResult {
  const fsw = spec.fsw

  const required_attenuation_db = resolveAttenuationTarget(opts, emi)
  const { dm_inductor, dm_capacitor, filter_resonant_freq, filter_attenuation_at_fsw, z0 } =
    computeDmFilter(spec, result, fsw)
  const { damping_resistor, damping_capacitor } = computeDampingNetwork(z0, dm_capacitor)
  const { negative_input_impedance, filter_output_impedance_at_resonance, stability_margin_db, middlebrook_stable } =
    computeMiddlebrook(spec, result, damping_resistor)
  const { cm_choke, was_clamped, x_capacitor, y_capacitors } = computeCmFilter(opts, emi, fsw)

  const filter_inductor_loss_w = result.peakCurrent ** 2 * Math.max(0.005, z0 / 100)

  const components = buildFilterComponents(
    spec, result, dm_inductor, dm_capacitor, damping_resistor, damping_capacitor,
    cm_choke, x_capacitor, y_capacitors,
  )
  const warnings = buildFilterWarnings(
    spec, filter_resonant_freq, filter_attenuation_at_fsw, required_attenuation_db,
    middlebrook_stable, stability_margin_db, filter_output_impedance_at_resonance,
    negative_input_impedance, cm_choke, was_clamped,
  )

  return {
    dm_inductor, dm_capacitor,
    cm_choke, x_capacitor, y_capacitors,
    damping_resistor, damping_capacitor,
    filter_resonant_freq, filter_attenuation_at_fsw, required_attenuation_db,
    middlebrook_stable, negative_input_impedance, filter_output_impedance_at_resonance,
    stability_margin_db, filter_inductor_loss_w, components, warnings,
  }
}
