import type { DesignSpec, DesignResult } from '../types'
import { nearestE12 } from './format'

export interface DmFilterResult {
  dm_inductor:              number
  dm_capacitor:             number
  filter_resonant_freq:     number
  filter_attenuation_at_fsw: number
  z0:                       number
}

// Target resonance: f_res = fsw / 10 gives 40 dB/dec roll-off well below fsw.
// Z0 ≈ Vin / (2 × Ipeak) — balanced L/C split at resonance (Erickson §10.1 eq. 10.4).
export function computeDmFilter(spec: DesignSpec, result: DesignResult, fsw: number): DmFilterResult {
  const f_res_target = Math.max(1000, fsw / 10)
  const z0           = Math.max(1, spec.vinMin / (2 * Math.max(result.peakCurrent, 0.1)))
  const omega_res    = 2 * Math.PI * f_res_target
  const dm_inductor  = nearestE12(z0 / omega_res)
  const dm_capacitor = nearestE12(1 / (z0 * omega_res))
  const filter_resonant_freq       = 1 / (2 * Math.PI * Math.sqrt(dm_inductor * dm_capacitor))
  // 40 dB/dec above resonance — TI SLYT636 eq. 1
  const filter_attenuation_at_fsw  = 40 * Math.log10(Math.max(fsw / filter_resonant_freq, 1))
  return { dm_inductor, dm_capacitor, filter_resonant_freq, filter_attenuation_at_fsw, z0 }
}

// Rd + Cd damping network (Erickson §10.2).
// Rd = Z0/3 → Q ≈ 1. Cd = 4 × Cf ensures Rd doesn't short Cf at DC.
export function computeDampingNetwork(z0: number, dm_capacitor: number) {
  return {
    damping_resistor:  z0 / 3,
    damping_capacitor: nearestE12(4 * dm_capacitor),
  }
}
