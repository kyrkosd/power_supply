import type { DesignSpec } from '../../types'

export interface ForwardRatings {
  primaryCurrentAvg: number  // A
  Ip_peak:           number  // A — primary peak current (Iout/N + ΔIm/2)
  I_cin_rms:         number  // A — input cap RMS current
  cin:               number  // F — minimum input capacitance (1% ripple)
  mosfetVdsMax:      number  // V — Vin_max + Vclamp
  diodeVrMax:        number  // V — secondary diode reverse voltage
  d1IfAvg:           number  // A — forward diode average current
  d2IfAvg:           number  // A — freewheel diode average current
}

// Primary and component voltage/current ratings for a forward converter.
// MOSFET: Vds_max = Vin_max + Vclamp; secondary diodes: Vr ≈ Vin_max/N + Vout.
// Erickson & Maksimovic 3rd ed., Table 6-1.
export function computeRatings(
  spec: DesignSpec,
  dutyCycle: number,
  dMax: number,
  turnsRatio: number,
  deltaIm_target: number,
  vClamp: number,
): ForwardRatings {
  const { vinMin, vinMax, vout, iout, fsw } = spec
  const pout              = vout * iout
  const eta               = Math.min(Math.max(spec.efficiency, 0.5), 1)
  const primaryCurrentAvg = (pout / eta) / vinMin
  const Ip_peak           = iout / turnsRatio + deltaIm_target
  const I_cin_rms         = Ip_peak * Math.sqrt(dutyCycle)
  const cin               = (primaryCurrentAvg * dMax) / (fsw * 0.01 * vinMin)
  const mosfetVdsMax      = vinMax + vClamp
  const diodeVrMax        = vinMax / turnsRatio + vout
  const d1IfAvg           = iout * dMax
  const d2IfAvg           = iout * (1 - dMax)
  return { primaryCurrentAvg, Ip_peak, I_cin_rms, cin, mosfetVdsMax, diodeVrMax, d1IfAvg, d2IfAvg }
}
