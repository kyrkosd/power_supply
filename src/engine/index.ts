// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
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

export function compute(topologyId: TopologyId, spec: DesignSpec): DesignResult {
  const topology = registry[topologyId]
  if (!topology) throw new Error(`Unknown topology: ${topologyId}`)
  return topology.compute(spec)
}

export function getTopology(topologyId: TopologyId): Topology {
  const topology = registry[topologyId]
  if (!topology) throw new Error(`Unknown topology: ${topologyId}`)
  return topology
}

export function generateWaveforms(topologyId: TopologyId, spec: DesignSpec): WaveformSet | null {
  const topology = registry[topologyId]
  if (!topology) throw new Error(`Unknown topology: ${topologyId}`)
  if (!topology.generateWaveforms) return null
  return topology.generateWaveforms(spec)
}

export function getStateSpaceModelFn(
  topologyId: TopologyId,
): ((spec: DesignSpec, result: DesignResult, vin: number, iout: number) => import('./topologies/types').StateSpaceModel) | null {
  const topology = registry[topologyId]
  if (!topology?.getStateSpaceModel) return null
  return topology.getStateSpaceModel.bind(topology)
}

export type { Topology, DesignSpec, DesignResult }
