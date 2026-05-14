// Average state-space model for the buck converter (averaged over a switching period).
// Used by the transient solver: A·x + B·u during on-time (subscript 1) and off-time (subscript 2).

import type { DesignSpec, DesignResult } from '../../types'
import type { StateSpaceModel } from '../types'

const DCR_DEFAULT     = 0.01   // Ω
const VD_DEFAULT      = 0.5    // V (diode forward drop)
const L_FALLBACK      = 10e-6
const C_FALLBACK      = 10e-6
const R_OPEN_CIRCUIT  = 10000

function loadResistance(spec: DesignSpec, current_iout: number): number {
  return current_iout > 0.001 ? spec.vout / current_iout : R_OPEN_CIRCUIT
}

export function buckStateSpace(
  spec: DesignSpec, result: DesignResult, current_vin: number, current_iout: number,
): StateSpaceModel {
  const res = result as DesignResult & { inductance?: number; capacitance?: number; inductor?: { value: number }; output_cap?: { value: number } }
  const L = res.inductance || res.inductor?.value   || L_FALLBACK
  const C = res.capacitance || res.output_cap?.value || C_FALLBACK
  const R = loadResistance(spec, current_iout)

  const Acommon: [[number, number], [number, number]] = [[-DCR_DEFAULT / L, -1 / L], [1 / C, -1 / (C * R)]]
  return {
    A1: Acommon,
    B1: [[current_vin / L], [0]],
    A2: Acommon,
    B2: [[-VD_DEFAULT / L], [0]],
  }
}
