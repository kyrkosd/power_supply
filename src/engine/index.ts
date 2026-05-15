import { TopologyId } from '../store/workbenchStore'
import { Topology, DesignSpec, DesignResult } from './types'
import type { WaveformSet } from './topologies/types'
import { buckTopology } from './topologies/buck'
import { boostTopology } from './topologies/boost'
import { buckBoostTopology } from './topologies/buckBoost'
import { flybackTopology } from './topologies/flyback'
import { forwardTopology } from './topologies/forward'
import { sepicTopology } from './topologies/sepic'

const registry: Record<TopologyId, Topology> = {
  buck: buckTopology,
  boost: boostTopology,
  'buck-boost': buckBoostTopology,
  flyback: flybackTopology,
  forward: forwardTopology,
  sepic: sepicTopology
}

// Called by: worker/plugin-registry.ts (computeAny), SequencingView.tsx (direct, no worker)
// Why: worker uses this for every COMPUTE message; SequencingView calls it synchronously when
// loading a .pswb rail file because it needs a one-shot result without debouncing.
export function compute(topologyId: TopologyId, spec: DesignSpec): DesignResult {
  const topology = registry[topologyId]
  if (!topology) throw new Error(`Unknown topology: ${topologyId}`)
  return topology.compute(spec)
}

// Called by: worker/handlers.ts (handleMC → resolveTopology), worker/sweep.ts (resolveTopology)
// Why: MC and sweep need the full Topology object (not just the result) to access
// getTransferFunction for phase-margin computation at perturbed operating points.
export function getTopology(topologyId: TopologyId): Topology {
  const topology = registry[topologyId]
  if (!topology) throw new Error(`Unknown topology: ${topologyId}`)
  return topology
}

// Called by: worker/compute.ts (generateWaveformsAny)
// Why: waveforms are generated after the main COMPUTE result so they share the same spec
// without a second full compute call. Returns null for topologies that don't implement
// generateWaveforms (boost, flyback, etc.) — callers skip waveform rendering in that case.
export function generateWaveforms(topologyId: TopologyId, spec: DesignSpec): WaveformSet | null {
  const topology = registry[topologyId]
  if (!topology) throw new Error(`Unknown topology: ${topologyId}`)
  if (!topology.generateWaveforms) return null
  return topology.generateWaveforms(spec)
}

// Called by: worker/handlers.ts (handleTransient)
// Why: the transient handler needs a bound function reference it can call at each RK4 step
// without knowing which topology is active. Returns null for topologies without a state-space
// model, causing the handler to post an error instead of attempting the simulation.
export function getStateSpaceModelFn(
  topologyId: TopologyId,
): ((spec: DesignSpec, result: DesignResult, vin: number, iout: number) => import('./topologies/types').StateSpaceModel) | null {
  const topology = registry[topologyId]
  if (!topology?.getStateSpaceModel) return null
  return topology.getStateSpaceModel.bind(topology)
}

export type { Topology, DesignSpec, DesignResult }
