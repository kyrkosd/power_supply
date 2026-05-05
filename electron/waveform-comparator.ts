import type { WaveformSet, DesignResult } from '../topologies/types'
import type { LTspiceMetrics } from './output-parser'

export interface ComparisonMetrics {
  efficiency_delta_pct: number
  ripple_delta_pct:     number
  il_rms_error:         number
  vsw_rms_error:        number
  ripple_rms_error:     number
}

export interface ComparisonResult {
  metrics:    ComparisonMetrics
  analytical: WaveformSet
  simulated:  WaveformSet
  delta: {
    il:     Float64Array
    vsw:    Float64Array
    ripple: Float64Array
  }
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function rmsError(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length || a.length === 0) return NaN
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum / a.length)
}

function peakToPeak(arr: Float64Array): number {
  return Math.max(...arr) - Math.min(...arr)
}

// ── Comparison helpers ────────────────────────────────────────────────────────

function buildDeltaArrays(
  analyticalWf: WaveformSet,
  simulatedWf:  Omit<WaveformSet, 'diode_current'>
): ComparisonResult['delta'] {
  const n      = analyticalWf.time.length
  const il     = new Float64Array(n)
  const vsw    = new Float64Array(n)
  const ripple = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    il[i]     = simulatedWf.inductor_current[i] - analyticalWf.inductor_current[i]
    vsw[i]    = simulatedWf.switch_node[i]      - analyticalWf.switch_node[i]
    ripple[i] = simulatedWf.output_ripple[i]    - analyticalWf.output_ripple[i]
  }
  return { il, vsw, ripple }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function compareWaveforms(
  analyticalResult: DesignResult,
  analyticalWf:     WaveformSet,
  simulatedWf:      Omit<WaveformSet, 'diode_current'>,
  simulatedMetrics: LTspiceMetrics
): ComparisonResult {
  const analyticalEfficiency = analyticalResult.efficiency
  const analyticalRipple     = peakToPeak(analyticalWf.output_ripple)

  const metrics: ComparisonMetrics = {
    efficiency_delta_pct: ((simulatedMetrics.efficiency - analyticalEfficiency) / analyticalEfficiency) * 100,
    ripple_delta_pct:     ((simulatedMetrics.vout_ripple - analyticalRipple) / analyticalRipple) * 100,
    il_rms_error:         rmsError(analyticalWf.inductor_current, simulatedWf.inductor_current),
    vsw_rms_error:        rmsError(analyticalWf.switch_node,      simulatedWf.switch_node),
    ripple_rms_error:     rmsError(analyticalWf.output_ripple,    simulatedWf.output_ripple),
  }

  const n = analyticalWf.time.length
  return {
    metrics,
    analytical: analyticalWf,
    simulated:  { ...simulatedWf, diode_current: new Float64Array(n) },
    delta:      buildDeltaArrays(analyticalWf, simulatedWf),
  }
}
