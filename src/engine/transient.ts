// RK4 state-space transient simulation for switching power supplies.
// Supports startup, load-step, and line-step modes.
import type { DesignSpec, DesignResult, StateSpaceModel, TransientResult, TransientMode } from './topologies/types'
import { rk4Step } from './transient/rk4'
import { initSimState, computeVref } from './transient/init'
import { computeTransientMetrics } from './transient/metrics'
import { applyModeTransition } from './transient/mode-step'

export function runTransientSimulation(
  spec: DesignSpec,
  result: DesignResult,
  mode: TransientMode,
  getModel: (spec: DesignSpec, result: DesignResult, vin: number, iout: number) => StateSpaceModel,
  softStartSeconds?: number,
): TransientResult {
  const fsw = spec.fsw ?? 200000
  const Tsw = 1 / fsw
  const dt  = Tsw / 20  // 20 integration steps per switching cycle
  const totalSteps = Math.floor(0.01 / dt)

  const time = new Float64Array(totalSteps)
  const vout = new Float64Array(totalSteps)
  const iL   = new Float64Array(totalSteps)
  const duty = new Float64Array(totalSteps)

  let { x, current_vin, current_iout, current_duty } = initSimState(mode, spec, result)
  let model = getModel(spec, result, current_vin, current_iout)

  let integral    = 0
  const Kp        = 0.02
  const Ki        = 2000
  let peak_inrush = 0

  for (let step = 0; step < totalSteps; step++) {
    const t = step * dt

    const stepped = applyModeTransition(t, mode, spec, current_vin, current_iout)
    if (stepped.changed) {
      current_vin  = stepped.vin
      current_iout = stepped.iout
      model = getModel(spec, result, current_vin, current_iout)
    }

    const vref   = computeVref(mode, t, softStartSeconds, spec.vout)
    const error  = vref - x[1]
    integral     = Math.max(-0.5, Math.min(0.5, integral + error * dt))
    current_duty = Math.max(0, Math.min(0.99, Kp * error + Ki * integral))

    const isSwitchOn = (t % Tsw) < (current_duty * Tsw)
    const [A, B] = isSwitchOn ? [model.A1, model.B1] : [model.A2, model.B2]
    x = rk4Step(x, A, B, dt)

    peak_inrush = Math.max(peak_inrush, x[0])
    time[step] = t
    iL[step]   = x[0]
    vout[step] = x[1]
    duty[step] = current_duty
  }

  const { settling_time_ms, overshoot_pct } = computeTransientMetrics(vout, time, spec.vout)
  return { time, vout, iL, duty, metrics: { settling_time_ms, overshoot_pct, peak_inrush_A: peak_inrush } }
}
