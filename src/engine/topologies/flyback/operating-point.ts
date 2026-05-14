import type { DesignSpec, SecondaryOutput } from '../../types'
import { computeDutyCycle, computeTurnsRatio, computeMagnetizingInductance } from './magnetics'

export interface FlybackOperatingPoint {
  dMax:                  number  // — — maximum duty cycle
  pTotal:                number  // W — total output power (all windings)
  magnetizingInductance: number  // H
  primaryCurrentAvg:     number  // A
  deltaIm:               number  // A — magnetizing current ripple
  primaryPeakCurrent:    number  // A
  turnsRatio:            number  // Np/Ns
}

// Duty cycle: Erickson & Maksimovic eq. 13.6.
// Magnetizing inductance: TI SLUA117B eq. 3.
export function computeOperatingPoint(spec: DesignSpec, secondaries: SecondaryOutput[]): FlybackOperatingPoint {
  const { vinMin, vinMax, vout, iout, fsw, rippleRatio, efficiency } = spec
  const vinNom       = (vinMin + vinMax) / 2
  const dMax         = computeDutyCycle(vinNom, vout)
  const pPrimary     = vout * iout
  const pSecondaries = secondaries.reduce((s, o) => s + o.vout * o.iout, 0)
  const pTotal       = pPrimary + pSecondaries

  const magnetizingInductance = computeMagnetizingInductance(vinMin, dMax, pTotal, fsw)
  const inputPower            = pTotal / Math.max(efficiency, 0.7)
  const primaryCurrentAvg     = inputPower / vinMin
  const deltaIm               = rippleRatio * primaryCurrentAvg
  const primaryPeakCurrent    = primaryCurrentAvg + deltaIm / 2
  const turnsRatio            = computeTurnsRatio(vinNom, dMax, vout)

  return { dMax, pTotal, magnetizingInductance, primaryCurrentAvg, deltaIm, primaryPeakCurrent, turnsRatio }
}
