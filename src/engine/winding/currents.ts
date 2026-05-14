// RMS current formulas for triangular CCM waveforms (Kazimierczuk eq. 4.11)
// and the per-topology primary / secondary RMS picker.

import type { DesignSpec, DesignResult } from '../types'

export function flybackPrimaryRms(Ip_peak: number, D: number): number {
  return Ip_peak * Math.sqrt(D / 3)
}

export function flybackSecondaryRms(Ip_peak: number, N: number, D: number): number {
  return (Ip_peak / N) * Math.sqrt((1 - D) / 3)
}

export function forwardPrimaryRms(spec: DesignSpec, result: DesignResult): number {
  const eta    = result.efficiency ?? spec.efficiency
  const Ip_avg = (spec.vout * spec.iout) / (eta * spec.vinMin)
  return Ip_avg * Math.sqrt(result.dutyCycle)
}

export function forwardSecondaryRms(iout: number, D: number): number {
  return iout * Math.sqrt(D)
}

export function computePrimaryAndSecRms(
  topology: 'flyback' | 'forward',
  spec: DesignSpec, result: DesignResult,
  Np: number, Ns: number, D: number,
): { Ip_rms: number; Is_rms_main: number } {
  if (topology === 'flyback') {
    const N = result.turnsRatio ?? (Np / Ns)
    return {
      Ip_rms:      flybackPrimaryRms(result.peakCurrent, D),
      Is_rms_main: flybackSecondaryRms(result.peakCurrent, N, D),
    }
  }
  return {
    Ip_rms:      forwardPrimaryRms(spec, result),
    Is_rms_main: forwardSecondaryRms(spec.iout, D),
  }
}
