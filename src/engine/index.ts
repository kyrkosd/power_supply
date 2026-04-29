import { TopologyId } from '../store/workbenchStore'
import { Topology, DesignSpec, DesignResult } from './types'
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

export type { Topology, DesignSpec, DesignResult }
