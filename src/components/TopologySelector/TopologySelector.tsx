import React, { useCallback, useState } from 'react'
import { useDesignStore, TopologyId } from '../../store/design-store'
import { TOPOLOGY_DEFAULTS } from '../../engine/topologies/defaults'
import type { DesignSpec } from '../../engine/types'
import styles from './TopologySelector.module.css'

const TOPOLOGIES: { id: TopologyId; label: string }[] = [
  { id: 'buck',       label: 'Buck (Step-Down)' },
  { id: 'boost',      label: 'Boost (Step-Up)' },
  { id: 'buck-boost', label: 'Buck-Boost' },
  { id: 'flyback',    label: 'Flyback' },
  { id: 'forward',    label: 'Forward' },
  { id: 'sepic',      label: 'SEPIC' },
]

function topologyLabel(id: TopologyId): string {
  return TOPOLOGIES.find((t) => t.id === id)?.label ?? id
}

function isSpecDefault(spec: DesignSpec, topology: TopologyId): boolean {
  const defaults = TOPOLOGY_DEFAULTS[topology]
  return (Object.keys(defaults) as Array<keyof DesignSpec>).every(
    (k) => spec[k] === defaults[k],
  )
}

export function TopologySelector(): React.ReactElement {
  const {
    topology, setTopology, setTopologyOnly, resetSpec, isComputing,
    spec, pluginTopologyId, plugins, setPluginTopology,
  } = useDesignStore()

  const [pendingTopology, setPendingTopology] = useState<TopologyId | null>(null)

  const handleChange = useCallback((newTopology: TopologyId) => {
    if (newTopology === topology) return
    if (isSpecDefault(spec, topology)) {
      setTopology(newTopology)
    } else {
      setPendingTopology(newTopology)
    }
  }, [topology, spec, setTopology])

  const confirmApply = useCallback(() => {
    if (pendingTopology) setTopology(pendingTopology)
    setPendingTopology(null)
  }, [pendingTopology, setTopology])

  const confirmKeep = useCallback(() => {
    if (pendingTopology) setTopologyOnly(pendingTopology)
    setPendingTopology(null)
  }, [pendingTopology, setTopologyOnly])

  return (
    <>
      <div className={styles.row}>
        <select
          className={styles.select}
          value={pluginTopologyId ?? topology}
          onChange={(e) => {
            const val = e.target.value
            const isBuiltin = TOPOLOGIES.some(t => t.id === val)
            if (isBuiltin) {
              setPluginTopology(null)
              handleChange(val as TopologyId)
            } else {
              setPluginTopology(val)
            }
          }}
        >
          <optgroup label="Built-in">
            {TOPOLOGIES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </optgroup>
          {plugins.filter(p => p.enabled).length > 0 && (
            <optgroup label="Community Plugins">
              {plugins.filter(p => p.enabled).map(p => (
                <option key={p.id} value={p.id}>⚡ {p.name}</option>
              ))}
            </optgroup>
          )}
        </select>
        {isComputing && <span className={styles.spinner} title="Computing…" />}
        <button
          className={styles.resetBtn}
          onClick={resetSpec}
          title={`Reset ${topology} to default values`}
        >
          ↺
        </button>
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
