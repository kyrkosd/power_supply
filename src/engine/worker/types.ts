// Web-worker message contract: request payloads, response envelopes, and the SweepParam alias.
// Pure type-only module — no runtime side effects.

import type { DesignSpec, DesignResult } from '../types'
import type { WaveformSet, TransientResult, TransientMode, EMIResult } from '../topologies/types'
import type { MonteCarloConfig, MonteCarloResult } from '../monte-carlo'
import type { PluginMeta, PluginSource } from '../plugin-types'

export type SweepParam = 'vin' | 'vout' | 'iout' | 'fsw' | 'ripple_ratio' | 'ambient_temp'

export interface ComputePayload      { topology: string; spec: DesignSpec }
export interface MCComputePayload    { topology: string; spec: DesignSpec; mcConfig: MonteCarloConfig }
export interface EfficiencyMapPayload { topology: string; spec: DesignSpec }
export interface TransientPayload    { topology: string; spec: DesignSpec; result: DesignResult; mode: TransientMode; softStartSeconds: number }
export interface SweepPayload        { topology: string; baseSpec: DesignSpec; sweepParam: SweepParam; min: number; max: number; steps: number }
export interface LoadPluginsPayload  { sources: PluginSource[]; disabledIds: string[] }

export interface SweepPoint {
  paramValue: number
  result: DesignResult | null
  phaseMargin: number | null
}

export type WorkerRequest =
  | { type: 'COMPUTE';           payload: ComputePayload }
  | { type: 'MC_COMPUTE';        payload: MCComputePayload }
  | { type: 'EFFICIENCY_MAP';    payload: EfficiencyMapPayload }
  | { type: 'TRANSIENT_COMPUTE'; payload: TransientPayload }
  | { type: 'SWEEP_COMPUTE';     payload: SweepPayload }
  | { type: 'LOAD_PLUGINS';      payload: LoadPluginsPayload }

export type ResultResponse           = { type: 'RESULT';                payload: { result: DesignResult; waveforms: WaveformSet | null; timing_ms: number; emiResult: EMIResult | null } }
export type MCResultResponse         = { type: 'MC_RESULT';             payload: MonteCarloResult }
export type EfficiencyMapResponse    = { type: 'EFFICIENCY_MAP_RESULT'; payload: { matrix: number[][]; vinPoints: number[]; ioutPoints: number[] } }
export type TransientResultResponse  = { type: 'TRANSIENT_RESULT';      payload: TransientResult }
export type SweepProgressResponse    = { type: 'SWEEP_PROGRESS';        payload: { current: number; total: number } }
export type SweepResultResponse      = { type: 'SWEEP_RESULT';          payload: { sweepParam: SweepParam; points: SweepPoint[] } }
export type ErrorResponse            = { type: 'ERROR';                 payload: { message: string } }
export type PluginsLoadedResponse    = { type: 'PLUGINS_LOADED';        payload: { plugins: PluginMeta[] } }

/** Send an error envelope, normalising thrown values into a string message. */
export function postError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  self.postMessage({ type: 'ERROR', payload: { message: msg } } as ErrorResponse)
}
