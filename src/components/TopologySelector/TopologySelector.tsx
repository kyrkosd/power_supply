// Topology selector: built-in topology dropdown + community plugin list with smart-defaults banner.
import React, { useCallback, useState } from 'react'
import { useDesignStore, TopologyId } from '../../store/design-store'
import { TOPOLOGY_DEFAULTS } from '../../engine/topologies/defaults'
import { getAll } from '../../engine/registry'
import type { DesignSpec } from '../../engine/types'
import styles from './TopologySelector.module.css'

// Build topology list from the registry so display names stay in one place (registry.ts).
const TOPOLOGIES: { id: TopologyId; label: string }[] = Array.from(getAll().entries()).map(
  ([id, eng]) => ({ id, label: eng.name }),
)

/** Display label for a built-in topology id. */
function topologyLabel(id: TopologyId): string {
  return TOPOLOGIES.find((t) => t.id === id)?.label ?? id
}

/** True when every key in the topology's defaults matches the current spec. */
function isSpecDefault(spec: DesignSpec, topology: TopologyId): boolean {
  const defaults = TOPOLOGY_DEFAULTS[topology]
  return (Object.keys(defaults) as Array<keyof DesignSpec>).every((k) => spec[k] === defaults[k])
}

/**
 * Topology dropdown with built-in and community plugin `<optgroup>`s.
 * When the user switches topology with a non-default spec, shows a banner
 * offering to apply the new topology's defaults or keep the current values.
 */
export function TopologySelector(): React.ReactElement {
  const {
    topology, setTopology, setTopologyOnly, resetSpec, isComputing,
    spec, pluginTopologyId, plugins, setPluginTopology,
  } = useDesignStore()

  const [pendingTopology, setPendingTopology] = useState<TopologyId | null>(null)

  const handleChange = useCallback((newTopology: TopologyId) => {
    if (newTopology === topology) return
    isSpecDefault(spec, topology) ? setTopology(newTopology) : setPendingTopology(newTopology)
  }, [topology, spec, setTopology])

  const confirmApply = useCallback(() => {
    if (pendingTopology) setTopology(pendingTopology)
    setPendingTopology(null)
  }, [pendingTopology, setTopology])

  const confirmKeep = useCallback(() => {
    if (pendingTopology) setTopologyOnly(pendingTopology)
    setPendingTopology(null)
  }, [pendingTopology, setTopologyOnly])

  const enabledPlugins = plugins.filter((p) => p.enabled)

  return (
    <>
      <div className={styles.row}>
        <select
          className={styles.select}
          value={pluginTopologyId ?? topology}
          onChange={(e) => {
            const val = e.target.value
            if (TOPOLOGIES.some((t) => t.id === val)) {
              setPluginTopology(null)
              handleChange(val as TopologyId)
            } else {
              setPluginTopology(val)
            }
          }}
        >
          <optgroup label="Built-in">
            {TOPOLOGIES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </optgroup>
          {enabledPlugins.length > 0 && (
            <optgroup label="Community Plugins">
              {enabledPlugins.map((p) => <option key={p.id} value={p.id}>⚡ {p.name}</option>)}
            </optgroup>
          )}
        </select>
        {isComputing && <span className={styles.spinner} title="Computing…" />}
        <button className={styles.resetBtn} onClick={resetSpec} title={`Reset ${topology} to default values`}>↺</button>
      </div>

      {pendingTopology && (
        <div className={styles.banner}>
          <span className={styles.bannerText}>
            Apply defaults for <strong>{topologyLabel(pendingTopology)}</strong>?
          </span>
          <div className={styles.bannerBtns}>
            <button className={styles.applyBtn} onClick={confirmApply}>Apply</button>
            <button className={styles.keepBtn} onClick={confirmKeep}>Keep</button>
          </div>
        </div>
      )}
    </>
  )
}
