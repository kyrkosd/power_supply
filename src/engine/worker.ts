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

type WorkerRequest =
  | { type: 'COMPUTE'; payload: ComputePayload }
  | { type: 'MC_COMPUTE'; payload: MCComputePayload }

type ResultResponse = {
  type: 'RESULT'
  payload: { result: DesignResult; waveforms: WaveformSet | null; timing_ms: number }
}
type MCResultResponse = {
  type: 'MC_RESULT'
  payload: MonteCarloResult
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
  }
})
