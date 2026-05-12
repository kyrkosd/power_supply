// RK4 state-space transient simulation for switching power supplies.
// Supports startup, load-step, and line-step modes.

import type { DesignSpec, DesignResult, StateSpaceModel, TransientResult, TransientMode } from './topologies/types';

/** State-space derivative: dx/dt = A·x + B (constant input assumed within one step). */
function computeDX(
  A: [[number, number], [number, number]],
  B: [[number], [number]],
  x: [number, number],
): [number, number] {
  return [
    A[0][0] * x[0] + A[0][1] * x[1] + B[0][0],
    A[1][0] * x[0] + A[1][1] * x[1] + B[1][0],
  ];
}

/** Classic 4th-order Runge-Kutta step for a linear state-space system. */
function rk4Step(
  x: [number, number],
  A: [[number, number], [number, number]],
  B: [[number], [number]],
  dt: number,
): [number, number] {
  const k1 = computeDX(A, B, x);
  const x2: [number, number] = [x[0] + k1[0] * dt / 2, x[1] + k1[1] * dt / 2];
  const k2 = computeDX(A, B, x2);
  const x3: [number, number] = [x[0] + k2[0] * dt / 2, x[1] + k2[1] * dt / 2];
  const k3 = computeDX(A, B, x3);
  const x4: [number, number] = [x[0] + k3[0] * dt, x[1] + k3[1] * dt];
  const k4 = computeDX(A, B, x4);
  return [
    x[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    x[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
  ];
}

/** Set initial state vector, vin, iout, and duty cycle for the chosen simulation mode. */
function initSimState(
  mode: TransientMode,
  spec: DesignSpec,
  result: DesignResult,
): { x: [number, number]; current_vin: number; current_iout: number; current_duty: number } {
  const vin_nom = (spec.vinMin + spec.vinMax) / 2;
  let current_vin = vin_nom;
  let current_iout = spec.iout;
  let x: [number, number] = [0, 0];

  if (mode === 'load-step' || mode === 'line-step') {
    current_iout = mode === 'load-step' ? spec.iout * 0.5 : spec.iout;
    current_vin  = mode === 'line-step' ? spec.vinMin : vin_nom;
    x = [current_iout, spec.vout];
  }

  return { x, current_vin, current_iout, current_duty: mode === 'startup' ? 0 : (result.dutyCycle || 0.5) };
}

/** Return the soft-start voltage reference at time t (ramps linearly during startup). */
function computeVref(
  mode: TransientMode,
  t: number,
  softStartSeconds: number | undefined,
  vout: number,
): number {
  if (mode !== 'startup') return vout;
  const softStartEnd = softStartSeconds ?? 0.002;
  return t < softStartEnd ? vout * (t / softStartEnd) : vout;
}

/** Compute settling time (2 % band) and overshoot from the recorded output voltage array. */
function computeTransientMetrics(
  voutArr: Float64Array,
  timeArr: Float64Array,
  vout: number,
): { settling_time_ms: number; overshoot_pct: number } {
  let maxV = 0;
  let settledIdx = voutArr.length - 1;
  for (let i = 0; i < voutArr.length; i++) if (voutArr[i] > maxV) maxV = voutArr[i];
  for (let i = voutArr.length - 1; i >= 0; i--) {
    if (Math.abs(voutArr[i] - vout) > 0.02 * vout) { settledIdx = i; break; }
  }
  return {
    overshoot_pct: Math.max(0, ((maxV - vout) / vout) * 100),
    settling_time_ms: timeArr[settledIdx] * 1000,
  };
}

/**
 * Run a 10 ms switched-mode transient simulation using a minimal PI closed-loop controller.
 * The state-space model toggles between on-state (A1, B1) and off-state (A2, B2) each sub-step.
 * Step disturbances (load or line) are applied at t = 2 ms.
 *
 * @param spec              Design specification
 * @param result            Nominal computed result (supplies dutyCycle)
 * @param mode              Simulation scenario: 'startup' | 'load-step' | 'line-step'
 * @param getModel          Callback that returns the state-space model for a given vin/iout
 * @param softStartSeconds  Soft-start duration from the soft-start calculator (startup mode only)
 */
export function runTransientSimulation(
  spec: DesignSpec,
  result: DesignResult,
  mode: TransientMode,
  getModel: (spec: DesignSpec, result: DesignResult, vin: number, iout: number) => StateSpaceModel,
  softStartSeconds?: number,
): TransientResult {
  const fsw = spec.fsw || 200000;
  const Tsw = 1 / fsw;
  const dt = Tsw / 20; // 20 integration steps per switching cycle
  const totalSteps = Math.floor(0.01 / dt);

  const time = new Float64Array(totalSteps);
  const vout = new Float64Array(totalSteps);
  const iL   = new Float64Array(totalSteps);
  const duty = new Float64Array(totalSteps);

  let { x, current_vin, current_iout, current_duty } = initSimState(mode, spec, result);
  let model = getModel(spec, result, current_vin, current_iout);

  // Minimal PI controller for closed-loop output regulation.
  let integral = 0;
  const Kp = 0.02;
  const Ki = 2000;
  let peak_inrush = 0;

  for (let step = 0; step < totalSteps; step++) {
    const t = step * dt;

    if (t >= 0.002) {
      if (mode === 'load-step' && current_iout !== spec.iout) {
        current_iout = spec.iout;
        model = getModel(spec, result, current_vin, current_iout);
      }
      if (mode === 'line-step' && current_vin !== spec.vinMax) {
        current_vin = spec.vinMax;
        model = getModel(spec, result, current_vin, current_iout);
      }
    }

    const vref  = computeVref(mode, t, softStartSeconds, spec.vout);
    const error = vref - x[1];
    integral     = Math.max(-0.5, Math.min(0.5, integral + error * dt));
    current_duty = Math.max(0, Math.min(0.99, Kp * error + Ki * integral));

    const isSwitchOn = (t % Tsw) < (current_duty * Tsw);
    x = rk4Step(x, isSwitchOn ? model.A1 : model.A2, isSwitchOn ? model.B1 : model.B2, dt);

    if (x[0] > peak_inrush) peak_inrush = x[0];
    time[step] = t;
    iL[step]   = x[0];
    vout[step] = x[1];
    duty[step] = current_duty;
  }

  const { settling_time_ms, overshoot_pct } = computeTransientMetrics(vout, time, spec.vout);
  return { time, vout, iL, duty, metrics: { settling_time_ms, overshoot_pct, peak_inrush_A: peak_inrush } };
}
