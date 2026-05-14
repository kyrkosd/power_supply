// Web Worker entry: a thin dispatch loop that delegates to per-message-type handlers.
// All heavy computation lives in worker/*.ts so the dispatcher stays small and testable.
//
// Message flow:
//   COMPUTE           → compute.scheduleCompute (debounced)
//   LOAD_PLUGINS      → plugin-registry.handleLoadPlugins
//   MC_COMPUTE        → handlers.handleMC
//   EFFICIENCY_MAP    → efficiency-map.computeEfficiencyMap
//   SWEEP_COMPUTE     → sweep.runSweep
//   TRANSIENT_COMPUTE → handlers.handleTransient

import { scheduleCompute }         from './worker/compute'
import { handleLoadPlugins, resolveTopology } from './worker/plugin-registry'
import { computeEfficiencyMap }    from './worker/efficiency-map'
import { runSweep }                from './worker/sweep'
import { handleMC, handleTransient } from './worker/handlers'
import { postError, type WorkerRequest } from './worker/types'

export type { SweepParam, SweepPoint } from './worker/types'

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (!message?.type) return

  switch (message.type) {
    case 'COMPUTE':           return scheduleCompute(message.payload)
    case 'LOAD_PLUGINS':      return handleLoadPlugins(message.payload)
    case 'MC_COMPUTE':        return handleMC(message.payload)
    case 'TRANSIENT_COMPUTE': return handleTransient(message.payload)
    case 'SWEEP_COMPUTE':     return runSweep(message.payload, resolveTopology)
    case 'EFFICIENCY_MAP':
      try { self.postMessage(computeEfficiencyMap(message.payload)) }
      catch (err) { postError(err) }
      return
  }
})
