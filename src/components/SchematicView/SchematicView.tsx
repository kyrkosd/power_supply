import React, { useMemo } from 'react'
import { useDesignStore } from '../../store/design-store'
import { SchematicRenderer } from './SchematicRenderer'
import { createBuckSchematic }      from './generators/buck'
import { createBoostSchematic }     from './generators/boost'
import { createBuckBoostSchematic } from './generators/buckBoost'
import { createFlybackSchematic }   from './generators/flyback'
import { createForwardSchematic }   from './generators/forward'
import { createSepicSchematic }     from './generators/sepic'
import { TOPOLOGY_DESCRIPTIONS }    from './schematic-types'
import styles from './SchematicView.module.css'

const DEFAULT_VIEW_BOX = '0 0 860 320'

function buildSchematic(topology: string, spec: ReturnType<typeof useDesignStore.getState>['spec'], result: ReturnType<typeof useDesignStore.getState>['result']) {
  if (topology === 'boost')      return { s: createBoostSchematic(spec, result),     vb: DEFAULT_VIEW_BOX }
  if (topology === 'buck-boost') return { s: createBuckBoostSchematic(spec, result), vb: DEFAULT_VIEW_BOX }
  if (topology === 'forward')    return { s: createForwardSchematic(spec, result),   vb: DEFAULT_VIEW_BOX }
  if (topology === 'sepic')      return { s: createSepicSchematic(spec, result),     vb: DEFAULT_VIEW_BOX }
  if (topology === 'flyback') {
    const h = 320 + (spec.secondary_outputs?.length ?? 0) * 90
    return { s: createFlybackSchematic(spec, result), vb: `0 0 860 ${h}` }
  }
  // Default: buck (covers unknown plugin topologies too)
  return { s: createBuckSchematic(spec, result), vb: DEFAULT_VIEW_BOX }
}

export function SchematicView(): React.ReactElement {
  const topology = useDesignStore((s) => s.topology)
  const spec     = useDesignStore((s) => s.spec)
  const result   = useDesignStore((s) => s.result)

  const { s: schematic, vb: viewBox } = useMemo(
    () => buildSchematic(topology, spec, result),
    [topology, spec, result],
  )

  const description =
    topology === 'buck' && (spec.phases ?? 1) > 1
      ? `${spec.phases}-Phase Interleaved Buck. ${spec.phases} switches phase-shifted by ${(360 / (spec.phases ?? 1)).toFixed(0)}° — ripple cancels at the output, reducing Cout and spreading thermal load across ${spec.phases} inductors.`
      : (TOPOLOGY_DESCRIPTIONS[topology] ?? 'Circuit schematic for the selected topology.')

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Schematic — {topology.toUpperCase()}</span>
        <span className={styles.badge}>{topology}</span>
      </div>
      <div className={styles.diagramWrapper}>
        <SchematicRenderer definition={schematic} viewBox={viewBox} />
      </div>
      <div className={styles.description}>{description}</div>
    </div>
  )
}
