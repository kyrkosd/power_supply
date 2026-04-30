import { DesignSpec, DesignResult, Topology } from '../types'

function normalizeDuty(duty: number): number {
  return Math.min(Math.max(duty, 0.01), 0.99)
}

export const buckBoostTopology: Topology = {
  id: 'buck-boost',
  name: 'Buck-Boost',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency } = spec
    const voutMag = Math.abs(vout)

    const targetEfficiency = Math.min(Math.max(efficiency, 0.5), 1)
    const rawDuty = voutMag / (vinMin * targetEfficiency + voutMag)
    const dutyCycle = normalizeDuty(rawDuty)

    const inputCurrent = iout / (1 - dutyCycle)
    const rippleFactor = Math.max(rippleRatio, 0.1)
    const deltaIL = rippleFactor * inputCurrent
    const inductance = (vinMin * dutyCycle) / (fsw * deltaIL)
    const peakCurrent = inputCurrent + deltaIL / 2
    const rmsCurrent = Math.sqrt(inputCurrent ** 2 + deltaIL ** 2 / 12)

    const deltaVout = Math.max(voutRippleMax, 0.01 * voutMag)
    const capacitance = (iout * dutyCycle) / (fsw * deltaVout)

    const inputCapValue = (inputCurrent * dutyCycle) / (fsw * Math.max(0.03 * vinMin, 1e-3))
    const inputCapRms = inputCurrent / Math.sqrt(12)

    const warnings: string[] = []
    if (dutyCycle >= 0.9) {
      warnings.push('Buck-boost duty cycle exceeds 90% and may reduce control margin and efficiency.')
    }
    if (dutyCycle <= 0.1) {
      warnings.push('Buck-boost duty cycle is below 10% and the converter may be sensitive to noise.')
    }
    if (peakCurrent > 3 * iout) {
      warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')
    }

    const rload = voutMag / iout
    const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
    const crossoverEstimate = fsw / 10
    if (frhpz > 0 && crossoverEstimate > frhpz / 3) {
      warnings.push(`Right-half-plane zero at ${Math.round(frhpz)} Hz may limit the crossover frequency.`)
    }

    return {
      dutyCycle,
      inductance,
      capacitance,
      peakCurrent,
      warnings,
    }
  },
}
