import type { DesignSpec } from '../../types'

export interface ForwardDuty {
  dutyCycle: number  // — — equals dMax (worst-case at Vin_min)
  dMax:      number  // — — RCD-constrained maximum duty cycle
  dMaxRcd:   number  // — — volt-second limit from reset network
  vClamp:    number  // V — RCD clamp voltage = 1.5 × Vin_max
}

// RCD-clamp duty cycle constraint for a single-switch forward converter.
// Volt-second balance: D_max ≤ Vin_min / (Vin_min + Vclamp).
// Reference: TI SLUA101; Erickson & Maksimovic 3rd ed., §6.2.2.
export function computeForwardDuty(spec: DesignSpec): ForwardDuty {
  const { vinMin, vinMax } = spec
  const vClamp  = 1.5 * vinMax
  const dMaxRcd = vinMin / (vinMin + vClamp)
  const dMax    = Math.min(0.45, dMaxRcd)
  return { dutyCycle: dMax, dMax, dMaxRcd, vClamp }
}
