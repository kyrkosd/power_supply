import type { DesignSpec } from '../../types'
import { normalizeDuty } from '../result-utils'

export interface BoostOperatingPoint {
  dutyCycle:    number  // —
  inputCurrent: number  // A — continuous inductor (= input) current
  deltaIL:      number  // A — inductor ripple
  inductance:   number  // H
  peakCurrent:  number  // A
  capacitance:  number  // F
}

// D = 1 − (Vin·η) / Vout; L = Vin·D / (fsw·ΔiL); Cout = Iout·D / (fsw·ΔVout).
// Erickson & Maksimovic 3rd ed., §2.3.
export function computeBoostOperatingPoint(spec: DesignSpec): BoostOperatingPoint {
  const { vinMin, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency: etaSpec } = spec

  const rawDuty      = 1 - (vinMin * Math.min(Math.max(etaSpec, 0.5), 1)) / vout
  const dutyCycle    = normalizeDuty(rawDuty)
  const inputCurrent = iout / (1 - dutyCycle)
  const rippleFactor = Math.max(rippleRatio, 0.1)
  const deltaIL      = rippleFactor * inputCurrent
  const inductance   = (vinMin * dutyCycle) / (fsw * deltaIL)
  const peakCurrent  = inputCurrent + deltaIL / 2
  const deltaVout    = Math.max(voutRippleMax, 0.01 * vout)
  const capacitance  = (iout * dutyCycle) / (fsw * deltaVout)

  return { dutyCycle, inputCurrent, deltaIL, inductance, peakCurrent, capacitance }
}
