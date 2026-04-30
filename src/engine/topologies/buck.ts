import { DesignSpec, DesignResult, Topology } from '../types'
import type { WaveformSet } from '../topologies/types'
import { analyzeBuckControlLoop } from '../control-loop'
import type { StateSpaceModel } from './types'

// Buck (step-down) converter steady-state design equations.
// Assumes CCM (Continuous Conduction Mode) and ideal switch/diode.
export const buckTopology: Topology = {
  id: 'buck',
  name: 'Buck (Step-Down)',

  compute(spec: DesignSpec): DesignResult {
    const { vinMax, vout, iout, fsw, rippleRatio, voutRippleMax } = spec

    const dutyCycle = Math.min(Math.max(vout / vinMax, 0.01), 0.99)
    const ripple = Math.max(rippleRatio, 0.05)
    const deltaIL = ripple * iout
    const inductance = (vout * (1 - dutyCycle)) / (deltaIL * fsw)

    const rippleVoltage = Math.max(voutRippleMax, 0.01 * vout)
    const capacitance = deltaIL / (8 * fsw * rippleVoltage)

    const peakCurrent = iout + deltaIL / 2
    const loop = analyzeBuckControlLoop(spec, { dutyCycle, inductance, capacitance, peakCurrent, warnings: [] })

    return { dutyCycle, inductance, capacitance, peakCurrent, warnings: loop.warnings }
  },

  generateWaveforms(spec: DesignSpec): WaveformSet {
    const { vinMax, vout, iout, fsw, rippleRatio, voutRippleMax } = spec
    const dutyCycle = Math.min(Math.max(vout / vinMax, 0.01), 0.99)
    const ripple = Math.max(rippleRatio, 0.05)
    const deltaIL = ripple * iout
    const iLmin = iout - deltaIL / 2
    const iLmax = iout + deltaIL / 2

    const cycles = 2
    const pointsPerCycle = 200
    const n = cycles * pointsPerCycle
    const period = 1 / fsw
    const dt = period / (pointsPerCycle - 1)
    const capAmplitude = Math.max(voutRippleMax, 0.01 * vout) / 2
    const esrAmplitude = capAmplitude * 0.25

    const time = new Float64Array(n)
    const inductor_current = new Float64Array(n)
    const switch_node = new Float64Array(n)
    const output_ripple = new Float64Array(n)
    const diode_current = new Float64Array(n)

    for (let idx = 0; idx < n; idx += 1) {
      const t = idx * dt
      const phase = t % period
      const onTime = dutyCycle * period
      const isOn = phase < onTime
      const phaseInSection = isOn ? phase / onTime : (phase - onTime) / (period - onTime)

      const iL = isOn
        ? iLmin + (iLmax - iLmin) * phaseInSection
        : iLmax - (iLmax - iLmin) * phaseInSection

      time[idx] = t
      inductor_current[idx] = iL
      switch_node[idx] = isOn ? vinMax : 0
      diode_current[idx] = isOn ? 0 : iL

      const triangular = ((iL - iout) / (deltaIL / 2)) * capAmplitude
      const rectangular = (isOn ? 1 : -1) * esrAmplitude
      output_ripple[idx] = triangular + rectangular
    }

    return {
      time,
      inductor_current,
      switch_node,
      output_ripple,
      diode_current,
    }
  },

  getStateSpaceModel(spec: DesignSpec, result: DesignResult, current_vin: number, current_iout: number): StateSpaceModel {
    const res = result as DesignResult & { inductance?: number; capacitance?: number; inductor?: { value: number }; output_cap?: { value: number } };
    const L = res.inductance || res.inductor?.value || 10e-6;
    const C = res.capacitance || res.output_cap?.value || 10e-6;
    const DCR = 0.01;
    const Vd = 0.5;
    const R = current_iout > 0.001 ? spec.vout / current_iout : 10000;

    return {
      A1: [
        [-DCR / L, -1 / L],
        [1 / C, -1 / (C * R)]
      ],
      B1: [[current_vin / L], [0]],
      A2: [
        [-DCR / L, -1 / L],
        [1 / C, -1 / (C * R)]
      ],
      B2: [[-Vd / L], [0]]
    };
  }
}
