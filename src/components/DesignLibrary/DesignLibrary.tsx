// Design library modal: searchable, filterable grid of reference designs.
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useDesignStore } from '../../store/design-store'
import { REFERENCE_DESIGNS, type ReferenceDesign } from '../../data/reference-designs/index'
import type { TopologyId } from '../../store/design-store'
import { TopoBadge, DiffBadge, DetailView, TOPO_COLOR } from './libraryCards'
import styles from './DesignLibrary.module.css'

const ALL_TOPOLOGIES: TopologyId[]                    = ['buck', 'boost', 'buck-boost', 'flyback', 'forward', 'sepic']
const ALL_DIFFICULTIES: ReferenceDesign['difficulty'][] = ['beginner', 'intermediate', 'advanced']

function matchesSearch(d: ReferenceDesign, q: string): boolean {
  if (!q) return true
  return d.title.toLowerCase().includes(q)
    || d.application.toLowerCase().includes(q)
    || d.description.toLowerCase().includes(q)
}

function matchesFilters(d: ReferenceDesign, topoFilter: TopologyId | 'all', diffFilter: ReferenceDesign['difficulty'] | 'all', q: string): boolean {
  if (topoFilter !== 'all' && d.topology !== topoFilter) return false
  if (diffFilter !== 'all' && d.difficulty !== diffFilter) return false
  return matchesSearch(d, q)
}

interface BrowseProps {
  filtered: ReferenceDesign[]
  selected: ReferenceDesign | null
  setSelected: (d: ReferenceDesign) => void
  search: string
  setSearch: (s: string) => void
  topoFilter: TopologyId | 'all'
  setTopoFilter: (t: TopologyId | 'all') => void
  diffFilter: ReferenceDesign['difficulty'] | 'all'
  setDiffFilter: (d: ReferenceDesign['difficulty'] | 'all') => void
}

function LibraryBrowse({ filtered, selected, setSelected, search, setSearch, topoFilter, setTopoFilter, diffFilter, setDiffFilter }: BrowseProps): React.ReactElement {
  return (
    <>
      <div className={styles.filterBar}>
        <input className={styles.searchInput} placeholder="Search designs…"
          value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className={styles.filterDivider} />

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Topology</span>
          <button className={`${styles.pill} ${topoFilter === 'all' ? styles.active : ''}`}
            onClick={() => setTopoFilter('all')}>All</button>
          {ALL_TOPOLOGIES.map((t) => {
            const active = topoFilter === t
            const c = TOPO_COLOR[t]
            return (
              <button key={t}
                className={`${styles.pill} ${active ? styles.active : ''}`}
                onClick={() => setTopoFilter(t)}
                style={active ? { color: c?.text, borderColor: (c?.text ?? '') + '88', background: c?.bg } : undefined}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            )
          })}
        </div>

        <div className={styles.filterDivider} />

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Level</span>
          <button className={`${styles.pill} ${diffFilter === 'all' ? styles.active : ''}`}
            onClick={() => setDiffFilter('all')}>All</button>
          {ALL_DIFFICULTIES.map((d) => (
            <button key={d}
              className={`${styles.pill} ${diffFilter === d ? styles.active : ''}`}
              onClick={() => setDiffFilter(d)}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        <span className={styles.countBadge}>
          {filtered.length} design{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className={styles.gridWrap}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>No designs match the current filters</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((d) => (
              <div key={d.title}
                className={`${styles.card} ${selected === d ? styles.selected : ''}`}
                onClick={() => setSelected(d)}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>{d.title}</span>
                  <TopoBadge topo={d.topology} />
                </div>
                <DiffBadge diff={d.difficulty} />
                <div className={styles.cardApp}>{d.application}</div>
                <div className={styles.cardDesc}>{d.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Design library modal — opens via Ctrl+L or toolbar button.
 * Supports text search across title, application, and description fields.
 * Topology and difficulty filters use pill buttons. Selecting a card opens the detail view.
 */
export function DesignLibrary(): React.ReactElement | null {
  const isLibraryOpen    = useDesignStore((s) => s.isLibraryOpen)
  const setIsLibraryOpen = useDesignStore((s) => s.setIsLibraryOpen)
  const isModified       = useDesignStore((s) => s.isModified)
  const loadDesignSpec   = useDesignStore((s) => s.loadDesignSpec)

  const [search,     setSearch]     = useState('')
  const [topoFilter, setTopoFilter] = useState<TopologyId | 'all'>('all')
  const [diffFilter, setDiffFilter] = useState<ReferenceDesign['difficulty'] | 'all'>('all')
  const [selected,   setSelected]   = useState<ReferenceDesign | null>(null)

  // Escape: collapse detail → close modal
  useEffect(() => {
    if (!isLibraryOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      selected ? setSelected(null) : setIsLibraryOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isLibraryOpen, selected, setIsLibraryOpen])

  // Reset detail view when modal closes
  useEffect(() => { if (!isLibraryOpen) setSelected(null) }, [isLibraryOpen])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return REFERENCE_DESIGNS.filter((d) => matchesFilters(d, topoFilter, diffFilter, q))
  }, [search, topoFilter, diffFilter])

  const handleLoad = useCallback((d: ReferenceDesign) => {
    if (isModified) {
      const ok = window.confirm('Your current design has unsaved changes. Load the reference design anyway?')
      if (!ok) return
    }
    loadDesignSpec(d.topology as TopologyId, d.spec)
    setIsLibraryOpen(false)
  }, [isModified, loadDesignSpec, setIsLibraryOpen])

  if (!isLibraryOpen) return null

  return (
    <div className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) setIsLibraryOpen(false) }}>
      <div className={styles.panel}>

        <div className={styles.header}>
          <span className={styles.headerIcon}>📚</span>
          <span className={styles.headerTitle}>Design Library</span>
          <span className={styles.headerSubtitle}>
            {REFERENCE_DESIGNS.length} reference designs — load any as a starting point
          </span>
          <button className={styles.headerClose} onClick={() => setIsLibraryOpen(false)}>×</button>
        </div>

        {selected ? (
          <DetailView design={selected} onBack={() => setSelected(null)}
            onLoad={handleLoad} isModified={isModified} />
        ) : (
          <LibraryBrowse
            filtered={filtered} selected={selected} setSelected={setSelected}
            search={search} setSearch={setSearch}
            topoFilter={topoFilter} setTopoFilter={setTopoFilter}
            diffFilter={diffFilter} setDiffFilter={setDiffFilter}
          />
        )}

      </div>
    </div>
  )
}
