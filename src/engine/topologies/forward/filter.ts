import type { DesignSpec } from '../../types'

export interface ForwardOutputFilter {
  outputInductance: number  // H — Lo (post-rectifier filter inductor)
  deltaIL:          number  // A — inductor ripple
  IL_peak:          number  // A — inductor peak current
  IL_rms:           number  // A
  capacitance:      number  // F — output capacitor
  esr_max:          number  // Ω — maximum output cap ESR
  I_cout_rms:       number  // A
}

// Output filter (Lo and Cout) for the single-switch forward converter.
// Post-rectifier stage is identical to a buck converter output filter.
// Erickson & Maksimovic 3rd ed., §§6.3, 2.4.
export function computeOutputFilter(spec: DesignSpec, dutyCycle: number): ForwardOutputFilter {
  const { vout, iout, fsw, rippleRatio, voutRippleMax } = spec
  const rippleFactor    = Math.max(rippleRatio, 0.1)
  const deltaIL         = rippleFactor * iout
  const outputInductance = (vout * (1 - dutyCycle)) / (fsw * deltaIL)
  const IL_peak         = iout + deltaIL / 2
  const IL_rms          = Math.sqrt(iout ** 2 + deltaIL ** 2 / 12)
  const deltaVout       = Math.max(voutRippleMax, 0.01 * vout)
  const capacitance     = deltaIL / (8 * fsw * deltaVout)
  const esr_max         = deltaVout / deltaIL
  const I_cout_rms      = deltaIL / (2 * Math.sqrt(3))
  return { outputInductance, deltaIL, IL_peak, IL_rms, capacitance, esr_max, I_cout_rms }
}
