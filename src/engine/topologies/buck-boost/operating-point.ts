import type { DesignSpec } from '../../types'
import { normalizeDuty } from '../result-utils'

export interface BuckBoostOperatingPoint {
  dutyCycle:    number  // —
  IL_dc:        number  // A — DC bias of the single winding
  deltaIL:      number  // A — ripple
  inductance:   number  // H
  IL_peak:      number  // A
  IL_rms:       number  // A
  mosfetVdsMax: number  // V — Q1 and D1 both block Vin + |Vout|
  diodeVrMax:   number  // V
  capacitance:  number  // F
  esr_max:      number  // Ω
  I_cout_rms:   number  // A
  I_cin_rms:    number  // A
  cin:          number  // F — minimum input capacitance
}

// D = |Vout| / (Vin·η + |Vout|) at worst-case Vin_min.
// Both Q1 and D1 block Vin + |Vout| in their off-state.
// Erickson & Maksimovic 3rd ed., Table 2-1.
export function computeBuckBoostOperatingPoint(spec: DesignSpec): BuckBoostOperatingPoint {
  const { vinMin, vinMax, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency: etaSpec } = spec
  const voutMag = Math.abs(vout)
  const eta     = Math.min(Math.max(etaSpec, 0.5), 1)

  const dutyCycle    = normalizeDuty(voutMag / (vinMin * eta + voutMag))
  const IL_dc        = iout / (1 - dutyCycle)
  const rippleFactor = Math.max(rippleRatio, 0.1)
  const deltaIL      = rippleFactor * IL_dc
  const inductance   = (vinMin * dutyCycle) / (fsw * deltaIL)
  const IL_peak      = IL_dc + deltaIL / 2
  const IL_rms       = Math.sqrt(IL_dc ** 2 + deltaIL ** 2 / 12)

  const deltaVout   = Math.max(voutRippleMax, 0.01 * voutMag)
  const capacitance = (iout * dutyCycle) / (fsw * deltaVout)
  const esr_max     = deltaVout / IL_peak
  const I_cout_rms  = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))
  const I_cin_rms   = IL_rms * Math.sqrt(dutyCycle)
  const cin         = (IL_dc * dutyCycle) / (fsw * 0.01 * vinMin)

  const mosfetVdsMax = vinMax + voutMag
  const diodeVrMax   = vinMax + voutMag

  return { dutyCycle, IL_dc, deltaIL, inductance, IL_peak, IL_rms,
           mosfetVdsMax, diodeVrMax, capacitance, esr_max, I_cout_rms, I_cin_rms, cin }
}
