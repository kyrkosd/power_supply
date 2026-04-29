import { DesignSpec, DesignResult, Topology } from '../types'

export const boostTopology: Topology = {
  id: 'boost',
  name: 'Boost (Step-Up)',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vout, iout, fsw } = spec

    const dutyCycle = 1 - vinMin / vout
    const inputCurrent = iout / (1 - dutyCycle)

    const rippleRatio = 0.3
    const deltaIL = rippleRatio * inputCurrent
    const inductance = (vinMin * dutyCycle) / (deltaIL * fsw)

    const deltaVout = 0.01 * vout
    const capacitance = (iout * dutyCycle) / (fsw * deltaVout)

    const peakCurrent = inputCurrent + deltaIL / 2

    return { dutyCycle, inductance, capacitance, peakCurrent }
  }
}
