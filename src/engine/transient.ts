import type { DesignSpec, DesignResult, StateSpaceModel, TransientResult, TransientMode } from './topologies/types';

// Optimized 2x2 matrix dot product block without array allocations 
function computeDX(A: [[number, number], [number, number]], B: [[number], [number]], x: [number, number]): [number, number] {
  return [
    A[0][0] * x[0] + A[0][1] * x[1] + B[0][0],
    A[1][0] * x[0] + A[1][1] * x[1] + B[1][0]
  ];
}

function rk4Step(x: [number, number], A: [[number, number], [number, number]], B: [[number], [number]], dt: number): [number, number] {
  const k1 = computeDX(A, B, x);
  const x2: [number, number] = [x[0] + k1[0] * dt / 2, x[1] + k1[1] * dt / 2];
  const k2 = computeDX(A, B, x2);
  const x3: [number, number] = [x[0] + k2[0] * dt / 2, x[1] + k2[1] * dt / 2];
  const k3 = computeDX(A, B, x3);
  const x4: [number, number] = [x[0] + k3[0] * dt, x[1] + k3[1] * dt];
  const k4 = computeDX(A, B, x4);

  return [
    x[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    x[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
  ];
}

export function runTransientSimulation(
  spec: DesignSpec,
  result: DesignResult,
  mode: TransientMode,
  getModel: (spec: DesignSpec, result: DesignResult, vin: number, iout: number) => StateSpaceModel
): TransientResult {
  const fsw = spec.fsw || 200000;
  const Tsw = 1 / fsw;
  const dt = Tsw / 20; // 20 steps per cycle
  const duration = 0.01; // 10ms simulation length
  const totalSteps = Math.floor(duration / dt);

  const time = new Float64Array(totalSteps);
  const vout = new Float64Array(totalSteps);
  const iL = new Float64Array(totalSteps);
  const duty = new Float64Array(totalSteps);

  let current_vin = spec.vin_nom;
  let current_iout = spec.iout_max;
  let x: [number, number] = [0, 0]; // [iL, vC]

  if (mode === 'load-step' || mode === 'line-step') {
    current_iout = mode === 'load-step' ? spec.iout_max * 0.5 : spec.iout_max;
    current_vin = mode === 'line-step' ? spec.vin_min : spec.vin_nom;
    x = [current_iout, spec.vout];
  }

  let model = getModel(spec, result, current_vin, current_iout);

  // Minimal robust digital PI Controller to maintain regulation
  let integral = 0;
  const Kp = 0.02;
  const Ki = 2000;
  let current_duty = mode === 'startup' ? 0 : ((result as DesignResult & { dutyCycle?: number }).dutyCycle || result.duty_cycle || 0.5);
  let peak_inrush = 0;

  for (let step = 0; step < totalSteps; step++) {
    const t = step * dt;

    // Apply Step disturbances at 2ms
    if (t >= 0.002) {
      if (mode === 'load-step' && current_iout !== spec.iout_max) {
        current_iout = spec.iout_max;
        model = getModel(spec, result, current_vin, current_iout);
      }
      if (mode === 'line-step' && current_vin !== spec.vin_max) {
        current_vin = spec.vin_max;
        model = getModel(spec, result, current_vin, current_iout);
      }
    }

    // Soft-Start Profile 
    let vref = spec.vout;
    if (mode === 'startup') {
      const softStartEnd = 0.002;
      vref = t < softStartEnd ? spec.vout * (t / softStartEnd) : spec.vout;
    }

    // PI Control Evaluation
    const error = vref - x[1];
    integral = Math.max(-0.5, Math.min(0.5, integral + error * dt)); // Anti-windup
    current_duty = Math.max(0, Math.min(0.99, Kp * error + Ki * integral));

    const isSwitchOn = (t % Tsw) < (current_duty * Tsw);
    const A = isSwitchOn ? model.A1 : model.A2;
    const B = isSwitchOn ? model.B1 : model.B2;

    x = rk4Step(x, A, B, dt);

    if (x[0] > peak_inrush) peak_inrush = x[0];

    time[step] = t;
    iL[step] = x[0];
    vout[step] = x[1]; 
    duty[step] = current_duty;
  }

  // Metric Extraction
  let maxV = 0;
  let settledIdx = totalSteps - 1;
  
  for (let i = 0; i < totalSteps; i++) if (vout[i] > maxV) maxV = vout[i];
  for (let i = totalSteps - 1; i >= 0; i--) if (Math.abs(vout[i] - spec.vout) > 0.02 * spec.vout) { settledIdx = i; break; }

  const overshoot_pct = Math.max(0, ((maxV - spec.vout) / spec.vout) * 100);
  const settling_time_ms = time[settledIdx] * 1000;

  return { time, vout, iL, duty, metrics: { settling_time_ms, overshoot_pct, peak_inrush_A: peak_inrush } };
}