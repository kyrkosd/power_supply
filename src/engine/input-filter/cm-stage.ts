import type { InputFilterOptions } from './types'
import type { EMIResult } from '../topologies/types'
import { nearestE12 } from './format'

export interface CmFilterResult {
  cm_choke:    number
  was_clamped: boolean
  x_capacitor: number
  y_capacitors: number
}

// CM choke and safety capacitors.
// Y capacitors: IEC 60384-14 safety class, max 4.7 nF line-to-PE.
// Reference: Würth ANP008e §3.
export function computeCmFilter(opts: InputFilterOptions, emi: EMIResult, fsw: number): CmFilterResult {
  const cm_choke_raw = opts.cm_choke_h > 0
    ? opts.cm_choke_h
    : nearestE12(Math.max(1e-3,
        1 / (2 * Math.PI * Math.max(emi.first_failing_harmonic ?? fsw, fsw) * 2.2e-9 * 4),
      ))
  const cm_choke     = Math.min(47e-3, Math.max(1e-3, cm_choke_raw))
  return {
    cm_choke,
    was_clamped: cm_choke !== cm_choke_raw,
    x_capacitor: nearestE12(100e-9),
    y_capacitors: 2.2e-9,
  }
}
