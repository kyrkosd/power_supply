import { DesignSpec, DesignResult, Topology } from '../types'

// Buck (step-down) converter steady-state design equations.
// Assumes CCM (Continuous Conduction Mode) and ideal switch/diode.
export const buckTopology: Topology = {
  id: 'buck',
  name: 'Buck (Step-Down)',

  compute(spec: DesignSpec): DesignResult {
    const { vinMax, vout, iout, fsw } = spec

    const dutyCycle = vout / vinMax

    // Minimum inductance for CCM at 30% ripple ratio
    const rippleRatio = 0.3
    const deltaIL = rippleRatio * iout
    const inductance = (vout * (1 - dutyCycle)) / (deltaIL * fsw)

    // Output capacitance for 1% output voltage ripple
    const deltaVout = 0.01 * vout
    const capacitance = deltaIL / (8 * fsw * deltaVout)

    const peakCurrent = iout + deltaIL / 2

    return { dutyCycle, inductance, capacitance, peakCurrent }
  }
}
