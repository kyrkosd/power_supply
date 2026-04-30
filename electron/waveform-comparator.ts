import type { WaveformSet, DesignResult } from '../topologies/types';
import type { LTspiceMetrics } from './output-parser';

export interface ComparisonMetrics {
  efficiency_delta_pct: number;
  ripple_delta_pct: number;
  il_rms_error: number;
  vsw_rms_error: number;
  ripple_rms_error: number;
}

export interface ComparisonResult {
  metrics: ComparisonMetrics;
  analytical: WaveformSet;
  simulated: WaveformSet;
  delta: {
    il: Float64Array;
    vsw: Float64Array;
    ripple: Float64Array;
  };
}

function calculateRmsError(arr1: Float64Array, arr2: Float64Array): number {
  if (arr1.length !== arr2.length || arr1.length === 0) return NaN;
  let sumSqErr = 0;
  for (let i = 0; i < arr1.length; i++) {
    sumSqErr += (arr1[i] - arr2[i]) ** 2;
  }
  return Math.sqrt(sumSqErr / arr1.length);
}

export function compareWaveforms(
  analyticalResult: DesignResult,
  analyticalWf: WaveformSet,
  simulatedWf: Omit<WaveformSet, 'diode_current'>,
  simulatedMetrics: LTspiceMetrics
): ComparisonResult {
  
  // Metric comparison
  const analyticalEfficiency = analyticalResult.efficiency;
  const efficiency_delta_pct = ((simulatedMetrics.efficiency - analyticalEfficiency) / analyticalEfficiency) * 100;

  const analyticalRipple = Math.max(...analyticalWf.output_ripple) - Math.min(...analyticalWf.output_ripple);
  const ripple_delta_pct = ((simulatedMetrics.vout_ripple - analyticalRipple) / analyticalRipple) * 100;

  // Waveform RMS Error
  const il_rms_error = calculateRmsError(analyticalWf.inductor_current, simulatedWf.inductor_current);
  const vsw_rms_error = calculateRmsError(analyticalWf.switch_node, simulatedWf.switch_node);
  const ripple_rms_error = calculateRmsError(analyticalWf.output_ripple, simulatedWf.output_ripple);

  // Delta waveforms
  const n = analyticalWf.time.length;
  const delta_il = new Float64Array(n);
  const delta_vsw = new Float64Array(n);
  const delta_ripple = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    delta_il[i] = simulatedWf.inductor_current[i] - analyticalWf.inductor_current[i];
    delta_vsw[i] = simulatedWf.switch_node[i] - analyticalWf.switch_node[i];
    delta_ripple[i] = simulatedWf.output_ripple[i] - analyticalWf.output_ripple[i];
  }

  return {
    metrics: {
      efficiency_delta_pct,
      ripple_delta_pct,
      il_rms_error,
      vsw_rms_error,
      ripple_rms_error,
    },
    analytical: analyticalWf,
    simulated: { ...simulatedWf, diode_current: new Float64Array(n) }, // Stub diode current
    delta: {
      il: delta_il,
      vsw: delta_vsw,
      ripple: delta_ripple,
    },
  };
}