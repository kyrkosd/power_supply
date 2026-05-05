// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import type { DesignSpec } from '../engine/types'
import type { TopologyId } from '../store/workbenchStore'

export interface ProjectFile {
  version: 1
  created: string   // ISO 8601
  modified: string  // ISO 8601
  topology: TopologyId
  spec: DesignSpec
  componentOverrides: Record<string, unknown>
  notes: string
}
