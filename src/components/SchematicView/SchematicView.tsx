import React, { useMemo } from 'react'
import type { DesignSpec, DesignResult } from '../../engine/types'
import { useDesignStore } from '../../store/design-store'
import { SchematicRenderer } from './SchematicRenderer'
import { createBuckSchematic }      from './generators/buck'
import { createBoostSchematic }     from './generators/boost'
import { createBuckBoostSchematic } from './generators/buckBoost'
import { createFlybackSchematic }   from './generators/flyback'
import { createForwardSchematic }   from './generators/forward'
import { createSepicSchematic }     from './generators/sepic'
import { TOPOLOGY_DESCRIPTIONS }    from './schematic-types'
import type { SchematicDefinition } from './schematic-types'
import styles from './SchematicView.module.css'

const DEFAULT_VIEW_BOX = '0 0 860 320'

type SchematicResult = { definition: SchematicDefinition; viewBox: string }

/** Selects the correct topology generator and computes the flyback view-box height for multi-output. */
function buildSchematic(topology: string, spec: DesignSpec, result: DesignResult | null): SchematicResult {
  if (topology === 'boost')      return { definition: createBoostSchematic(spec, result),     viewBox: DEFAULT_VIEW_BOX }
  if (topology === 'buck-boost') return { definition: createBuckBoostSchematic(spec, result), viewBox: DEFAULT_VIEW_BOX }
  if (topology === 'forward')    return { definition: createForwardSchematic(spec, result),   viewBox: DEFAULT_VIEW_BOX }
  if (topology === 'sepic')      return { definition: createSepicSchematic(spec, result),     viewBox: DEFAULT_VIEW_BOX }
  if (topology === 'flyback') {
    const extraRows = spec.secondary_outputs?.length ?? 0
    const height    = 320 + extraRows * 90
    return { definition: createFlybackSchematic(spec, result), viewBox: `0 0 860 ${height}` }
  }
  // Default covers buck and unknown plugin topologies.
  return { definition: createBuckSchematic(spec, result), viewBox: DEFAULT_VIEW_BOX }
}

/** Returns the footer description for the current topology, with a multi-phase override for the buck. */
function topologyDescription(topology: string, spec: DesignSpec): string {
  const phases = spec.phases ?? 1
  if (topology === 'buck' && phases > 1) {
    const shift = (360 / phases).toFixed(0)
    return `${phases}-Phase Interleaved Buck. ${phases} switches phase-shifted by ${shift}° — ripple cancels at the output, reducing Cout and spreading thermal load across ${phases} inductors.`
  }
  return TOPOLOGY_DESCRIPTIONS[topology] ?? 'Circuit schematic for the selected topology.'
}

/** Renders the annotated SVG schematic for the currently selected power topology. */
export function SchematicView(): React.ReactElement {
  const topology = useDesignStore((s) => s.topology)
  const spec     = useDesignStore((s) => s.spec)
  const result   = useDesignStore((s) => s.result)

  const { definition, viewBox } = useMemo(
    () => buildSchematic(topology, spec, result),
    [topology, spec, result],
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Schematic — {topology.toUpperCase()}</span>
        <span className={styles.badge}>{topology}</span>
      </div>
      <div className={styles.diagramWrapper}>
        <SchematicRenderer definition={definition} viewBox={viewBox} />
      </div>
      <div className={styles.description}>{topologyDescription(topology, spec)}</div>
    </div>
  )
}
