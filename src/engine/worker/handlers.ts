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

// Called by: worker.ts message dispatch on 'MC_COMPUTE'
// Why: MC analysis runs the full topology compute for every iteration, so it lives in the
// worker to keep the renderer thread unblocked during the (potentially 1000-iteration) loop.
// A fresh nominalResult is computed from the current spec to guarantee the tolerance spread
// is centred on the actual operating point rather than on a stale cached result.
export function handleMC(payload: MCComputePayload): void {
  const { topology, spec, mcConfig } = payload
  try {
    const nominalResult = computeAny(topology, spec)
    const topologyObj   = resolveTopology(topology)
    const mcResult      = runMonteCarlo(topologyObj, spec, nominalResult, mcConfig)
    self.postMessage({ type: 'MC_RESULT', payload: mcResult } as MCResultResponse)
  } catch (err) { postError(err) }
}

// Called by: worker.ts message dispatch on 'TRANSIENT_COMPUTE'
// Why: transient simulation steps through thousands of RK4 time points and would freeze the
// renderer for 100–500 ms if run synchronously. The result arrays are transferred (not copied)
// as ArrayBuffers to avoid serialisation cost on the large Float64Array time/voltage/current data.
// getStateSpaceModelFn() is checked first — topologies without a state-space model (boost,
// flyback, etc.) post an error immediately rather than attempting a simulation with no model.
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
