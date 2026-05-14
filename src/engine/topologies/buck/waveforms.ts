// Buck waveform generator — produces 2 cycles of inductor current, switch node,
// output ripple, and diode current at the current operating point.

import type { DesignSpec } from '../../types'
import type { WaveformSet } from '../../topologies/types'
import { rippleCancelFactor } from './phase'

const CYCLES           = 2
const POINTS_PER_CYCLE = 200
const ESR_AMPL_FRACTION = 0.25

interface PhaseAmplitudes {
  iLmin:         number
  iLmax:         number
  deltaIL:       number
  capAmplitude:  number
  esrAmplitude:  number
}

function computePhaseAmplitudes(spec: DesignSpec, dutyCycle: number, N: number): PhaseAmplitudes {
  const { vout, iout, fsw, rippleRatio, voutRippleMax } = spec
  const ripple         = Math.max(rippleRatio, 0.05)
  const deltaIL_single = ripple * iout
  const L_single       = (vout * (1 - dutyCycle)) / (deltaIL_single * fsw)
  const { K_floor } = rippleCancelFactor(N, dutyCycle)
  const L_phase   = L_single * K_floor
  const deltaIL   = (vout * (1 - dutyCycle)) / (L_phase * fsw)
  const iAvg      = iout / N
  const capAmplitude = Math.max(voutRippleMax, 0.01 * vout) / 2
  return {
    iLmin:        iAvg - deltaIL / 2,
    iLmax:        iAvg + deltaIL / 2,
    deltaIL,
    capAmplitude,
    esrAmplitude: capAmplitude * ESR_AMPL_FRACTION,
  }
}

export function generateBuckWaveforms(spec: DesignSpec): WaveformSet {
  const { vinMax, vout, fsw, iout } = spec
  const N = Math.max(1, Math.min(6, Math.round(spec.phases ?? 1)))
  const dutyCycle = Math.min(Math.max(vout / vinMax, 0.01), 0.99)
  const { iLmin, iLmax, deltaIL, capAmplitude, esrAmplitude } = computePhaseAmplitudes(spec, dutyCycle, N)

  const n      = CYCLES * POINTS_PER_CYCLE
  const period = 1 / fsw
  const dt     = period / (POINTS_PER_CYCLE - 1)
  const iAvg   = iout / N

  const time             = new Float64Array(n)
  const inductor_current = new Float64Array(n)
  const switch_node      = new Float64Array(n)
  const output_ripple    = new Float64Array(n)
  const diode_current    = new Float64Array(n)

  for (let idx = 0; idx < n; idx++) {
    const t              = idx * dt
    const phase          = t % period
    const onTime         = dutyCycle * period
    const isOn           = phase < onTime
    const phaseInSection = isOn ? phase / onTime : (phase - onTime) / (period - onTime)
    const iL             = isOn
      ? iLmin + (iLmax - iLmin) * phaseInSection
      : iLmax - (iLmax - iLmin) * phaseInSection
    const triangular     = ((iL - iAvg) / (deltaIL / 2)) * capAmplitude
    const rectangular    = (isOn ? 1 : -1) * esrAmplitude

    time[idx]             = t
    inductor_current[idx] = iL
    switch_node[idx]      = isOn ? vinMax : 0
    diode_current[idx]    = isOn ? 0 : iL
    output_ripple[idx]    = triangular + rectangular
  }

  return { time, inductor_current, switch_node, output_ripple, diode_current }
}
