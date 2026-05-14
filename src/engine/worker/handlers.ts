// MC_COMPUTE and TRANSIENT_COMPUTE handlers — small enough to share a file.

import { getStateSpaceModelFn } from '../index'
import { runMonteCarlo } from '../monte-carlo'
import { runTransientSimulation } from '../transient'
import { computeAny, resolveTopology } from './plugin-registry'
import type {
  MCComputePayload, TransientPayload,
  MCResultResponse, TransientResultResponse,
} from './types'
import { postError } from './types'

export function handleMC(payload: MCComputePayload): void {
  const { topology, spec, mcConfig } = payload
  try {
    const nominalResult = computeAny(topology, spec)
    const topologyObj   = resolveTopology(topology)
    const mcResult      = runMonteCarlo(topologyObj, spec, nominalResult, mcConfig)
    self.postMessage({ type: 'MC_RESULT', payload: mcResult } as MCResultResponse)
  } catch (err) { postError(err) }
}

export function handleTransient(payload: TransientPayload): void {
  const { topology, spec, result, mode, softStartSeconds } = payload
  const getModel = getStateSpaceModelFn(topology)
  if (!getModel) {
    postError(new Error(`Topology '${topology}' does not implement getStateSpaceModel — transient unavailable`))
    return
  }
  try {
    const transientResult = runTransientSimulation(spec, result, mode, getModel, softStartSeconds)
    self.postMessage(
      { type: 'TRANSIENT_RESULT', payload: transientResult } as TransientResultResponse,
      {
        transfer: [
          transientResult.time.buffer as ArrayBuffer,
          transientResult.vout.buffer as ArrayBuffer,
          transientResult.iL.buffer   as ArrayBuffer,
          transientResult.duty.buffer as ArrayBuffer,
        ],
      },
    )
  } catch (err) { postError(err) }
}
