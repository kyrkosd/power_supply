import { compute, generateWaveforms, getTopology } from './index'
import { runMonteCarlo } from './monte-carlo'
import type { DesignSpec, DesignResult } from './types'
import type { WaveformSet } from './topologies/types'
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

type WorkerRequest =
  | { type: 'COMPUTE'; payload: ComputePayload }
  | { type: 'MC_COMPUTE'; payload: MCComputePayload }
  | { type: 'EFFICIENCY_MAP'; payload: EfficiencyMapPayload }

type ResultResponse = {
  type: 'RESULT'
  payload: { result: DesignResult; waveforms: WaveformSet | null; timing_ms: number }
}
type MCResultResponse = {
  type: 'MC_RESULT'
  payload: MonteCarloResult
}
type EfficiencyMapResponse = {
  type: 'EFFICIENCY_MAP_RESULT'
  payload: { matrix: number[][]; vinPoints: number[]; ioutPoints: number[] }
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
      const result = compute(topology, spec)
      const waveforms = generateWaveforms(topology, spec)
      const timing_ms = performance.now() - start
      const response: ResultResponse = { type: 'RESULT', payload: { result, waveforms, timing_ms } }
      if (waveforms) {
        self.postMessage(response, [
          waveforms.time.buffer,
          waveforms.inductor_current.buffer,
          waveforms.switch_node.buffer,
          waveforms.output_ripple.buffer,
          waveforms.diode_current.buffer,
        ])
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
  }
})
