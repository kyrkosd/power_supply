import { compute, generateWaveforms, getTopology, getStateSpaceModelFn } from './index'
import { runTransientSimulation } from './transient'
import { runMonteCarlo } from './monte-carlo'
import { designCurrentSense } from './current-sense'
import { estimateEMI } from './emi'
import { designInputFilter } from './input-filter'
import type { InputFilterOptions } from './input-filter'
import { designWinding } from './transformer-winding'
import { getCoreByType } from './topologies/core-selector'
import type { EMIResult } from './topologies/types'
import type { DesignSpec, DesignResult } from './types'
import type { WaveformSet, TransientResult, TransientMode } from './topologies/types'
import type { TopologyId } from '../store/workbenchStore'
import type { MonteCarloConfig, MonteCarloResult } from './monte-carlo'

interface ComputePayload {
  topology: TopologyId
  spec: DesignSpec
}

interface MCComputePayload {
  topology: TopologyId
  spec: DesignSpec
  mcConfig: MonteCarloConfig
}

interface EfficiencyMapPayload {
  topology: TopologyId
  spec: DesignSpec
}

interface TransientPayload {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult
  mode: TransientMode
  softStartSeconds: number
}

type WorkerRequest =
  | { type: 'COMPUTE'; payload: ComputePayload }
  | { type: 'MC_COMPUTE'; payload: MCComputePayload }
  | { type: 'EFFICIENCY_MAP'; payload: EfficiencyMapPayload }
  | { type: 'TRANSIENT_COMPUTE'; payload: TransientPayload }

type ResultResponse = {
  type: 'RESULT'
  payload: { result: DesignResult; waveforms: WaveformSet | null; timing_ms: number; emiResult: EMIResult | null }
}
type MCResultResponse = {
  type: 'MC_RESULT'
  payload: MonteCarloResult
}
type EfficiencyMapResponse = {
  type: 'EFFICIENCY_MAP_RESULT'
  payload: { matrix: number[][]; vinPoints: number[]; ioutPoints: number[] }
}
type TransientResultResponse = {
  type: 'TRANSIENT_RESULT'
  payload: TransientResult
}
type ErrorResponse = { type: 'ERROR'; payload: { message: string } }

const DEBOUNCE_MS = 8
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let latestPayload: ComputePayload | null = null

function scheduleCompute(payload: ComputePayload): void {
  latestPayload = payload
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (!latestPayload) return
    const { topology, spec } = latestPayload
    latestPayload = null
    const start = performance.now()
    try {
      let result = compute(topology, spec)
      if (spec.controlMode === 'current') {
        const cs = designCurrentSense(topology, spec, result, spec.senseMethod ?? 'resistor', spec.vsenseTargetMv ?? 150)
        result = { ...result, current_sense: cs }
      }
      // EMI + optional input filter
      const emiResult: EMIResult = estimateEMI(topology, spec, result)
      if (spec.inputFilterEnabled) {
        const filterOpts: InputFilterOptions = {
          enabled: true,
          attenuation_override_db: spec.inputFilterAttenuationDb ?? 0,
          cm_choke_h: (spec.inputFilterCmChokeMh ?? 0) / 1000,
        }
        const inputFilter = designInputFilter(topology, spec, result, emiResult, filterOpts)
        result = { ...result, input_filter: inputFilter }
      }
      // Transformer winding design (flyback and forward only)
      if ((topology === 'flyback' || topology === 'forward') && result.coreType) {
        const core = getCoreByType(result.coreType)
        if (core) {
          const winding = designWinding(topology, spec, result, core)
          result = { ...result, winding_result: winding }
        }
      }
      const waveforms = generateWaveforms(topology, spec)
      const timing_ms = performance.now() - start
      const response: ResultResponse = { type: 'RESULT', payload: { result, waveforms, timing_ms, emiResult } }
      if (waveforms) {
        self.postMessage(response, {
          transfer: [
            waveforms.time.buffer as ArrayBuffer,
            waveforms.inductor_current.buffer as ArrayBuffer,
            waveforms.switch_node.buffer as ArrayBuffer,
            waveforms.output_ripple.buffer as ArrayBuffer,
            waveforms.diode_current.buffer as ArrayBuffer,
          ],
        })
      } else {
        self.postMessage(response)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const response: ErrorResponse = { type: 'ERROR', payload: { message: msg } }
      self.postMessage(response)
    }
  }, DEBOUNCE_MS)
}

function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start]
  return Array.from({ length: n }, (_, i) => start + (end - start) * (i / (n - 1)))
}

function computeEfficiencyMap(payload: EfficiencyMapPayload): EfficiencyMapResponse {
  const { topology, spec } = payload
  const N = 10
  const vinMin = spec.vinMin
  const vinMax = spec.vinMax === spec.vinMin ? spec.vinMin + 1 : spec.vinMax
  const vinPoints = linspace(vinMin, vinMax, N)
  const ioutPoints = linspace(spec.iout * 0.1, spec.iout, N)
  const matrix: number[][] = []

  for (let vi = 0; vi < N; vi++) {
    const row: number[] = []
    for (let ii = 0; ii < N; ii++) {
      try {
        const variantSpec: DesignSpec = {
          ...spec,
          vinMin: vinPoints[vi],
          vinMax: vinPoints[vi],
          iout: ioutPoints[ii],
        }
        const result = compute(topology, variantSpec)
        row.push(result.efficiency ?? spec.efficiency)
      } catch {
        row.push(spec.efficiency)
      }
    }
    matrix.push(row)
  }

  return { type: 'EFFICIENCY_MAP_RESULT', payload: { matrix, vinPoints, ioutPoints } }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (!message?.type) return

  if (message.type === 'COMPUTE') {
    scheduleCompute(message.payload)
    return
  }

  if (message.type === 'MC_COMPUTE') {
    const { topology, spec, mcConfig } = message.payload
    try {
      const nominalResult = compute(topology, spec)
      const topologyObj = getTopology(topology)
      const mcResult = runMonteCarlo(topologyObj, spec, nominalResult, mcConfig)
      const response: MCResultResponse = { type: 'MC_RESULT', payload: mcResult }
      self.postMessage(response)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const response: ErrorResponse = { type: 'ERROR', payload: { message: msg } }
      self.postMessage(response)
    }
    return
  }

  if (message.type === 'EFFICIENCY_MAP') {
    try {
      const response = computeEfficiencyMap(message.payload)
      self.postMessage(response)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const response: ErrorResponse = { type: 'ERROR', payload: { message: msg } }
      self.postMessage(response)
    }
    return
  }

  if (message.type === 'TRANSIENT_COMPUTE') {
    const { topology, spec, result, mode, softStartSeconds } = message.payload
    const getModel = getStateSpaceModelFn(topology)
    if (!getModel) {
      const response: ErrorResponse = {
        type: 'ERROR',
        payload: { message: `Topology '${topology}' does not implement getStateSpaceModel — transient unavailable` },
      }
      self.postMessage(response)
      return
    }
    try {
      const transientResult = runTransientSimulation(spec, result, mode, getModel, softStartSeconds)
      const response: TransientResultResponse = { type: 'TRANSIENT_RESULT', payload: transientResult }
      self.postMessage(response, {
        transfer: [
          transientResult.time.buffer as ArrayBuffer,
          transientResult.vout.buffer as ArrayBuffer,
          transientResult.iL.buffer as ArrayBuffer,
          transientResult.duty.buffer as ArrayBuffer,
        ],
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const response: ErrorResponse = { type: 'ERROR', payload: { message: msg } }
      self.postMessage(response)
    }
  }
})
