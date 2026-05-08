import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useDesignStore } from '../../store/design-store'
import { REFERENCE_DESIGNS, type ReferenceDesign } from '../../data/reference-designs/index'
import type { TopologyId } from '../../store/design-store'
import styles from './DesignLibrary.module.css'

// ── Topology badge colours ────────────────────────────────────────────────────

const TOPO_COLOR: Record<string, { bg: string; text: string }> = {
  'buck':       { bg: 'rgba(50, 201, 230, 0.15)',  text: '#32c9e6' },
  'boost':      { bg: 'rgba(34, 197, 94, 0.15)',   text: '#22c55e' },
  'buck-boost': { bg: 'rgba(245, 158, 11, 0.15)',  text: '#f59e0b' },
  'flyback':    { bg: 'rgba(167, 139, 250, 0.15)', text: '#a78bfa' },
  'forward':    { bg: 'rgba(56, 189, 248, 0.15)',  text: '#38bdf8' },
  'sepic':      { bg: 'rgba(249, 115, 22, 0.15)',  text: '#f97316' },
}

function TopoBadge({ topo }: { topo: string }): React.ReactElement {
  const c = TOPO_COLOR[topo] ?? { bg: 'rgba(255,255,255,0.08)', text: '#94a3b8' }
  return (
    <span
      className={styles.topoBadge}
      style={{ background: c.bg, color: c.text }}
    >
      {topo.toUpperCase()}
    </span>
  )
}

function DiffBadge({ diff }: { diff: ReferenceDesign['difficulty'] }): React.ReactElement {
  return (
    <span className={`${styles.diffBadge} ${
      diff === 'beginner' ? styles.diffBeginner :
      diff === 'intermediate' ? styles.diffIntermediate :
      styles.diffAdvanced
    }`}>
      {diff.charAt(0).toUpperCase() + diff.slice(1)}
    </span>
  )
}

// ── Spec summary row ──────────────────────────────────────────────────────────

function SpecGrid({ d }: { d: ReferenceDesign }): React.ReactElement {
  const s = d.spec
  const cells: { label: string; value: string }[] = [
    { label: 'Vin', value: s.vinMin === s.vinMax ? `${s.vinMin} V` : `${s.vinMin}–${s.vinMax} V` },
    { label: 'Vout', value: `${s.vout} V` },
    { label: 'Iout', value: `${s.iout} A` },
    { label: 'Power', value: `${(s.vout * s.iout).toFixed(0)} W` },
    { label: 'fsw', value: s.fsw >= 1e6 ? `${(s.fsw / 1e6).toFixed(1)} MHz` : `${(s.fsw / 1e3).toFixed(0)} kHz` },
    { label: 'Target η', value: `${(s.efficiency * 100).toFixed(0)} %` },
  ]
  return (
    <div className={styles.specGrid}>
      {cells.map(c => (
        <div key={c.label} className={styles.specCell}>
          <div className={styles.specCellLabel}>{c.label}</div>
          <div className={styles.specCellValue}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Detail view ───────────────────────────────────────────────────────────────

interface DetailProps {
  design: ReferenceDesign
  onBack: () => void
  onLoad: (d: ReferenceDesign) => void
  isModified: boolean
}

function DetailView({ design: d, onBack, onLoad, isModified }: DetailProps): React.ReactElement {
  return (
    <div className={styles.detailWrap}>
      <button className={styles.detailBack} onClick={onBack}>
        ← Back to library
      </button>

      <div className={styles.detailHeader}>
        <div style={{ flex: 1 }}>
          <div className={styles.detailTitle}>{d.title}</div>
          <div className={styles.detailMeta}>
            <TopoBadge topo={d.topology} />
            <DiffBadge diff={d.difficulty} />
            <span className={styles.detailApp}>{d.application}</span>
          </div>
        </div>
      </div>

      <div className={styles.detailSection}>
        <div className={styles.detailSectionTitle}>Overview</div>
        <div className={styles.detailDesc}>{d.description}</div>
      </div>

      <div className={styles.detailSection}>
        <div className={styles.detailSectionTitle}>Specifications</div>
        <SpecGrid d={d} />
      </div>

      <div className={styles.detailSection}>
        <div className={styles.detailSectionTitle}>Design Notes</div>
        <div className={styles.detailNotes}>{d.design_notes}</div>
      </div>

      <div className={styles.detailSection}>
        <div className={styles.detailSectionTitle}>Reference</div>
        <div className={styles.detailSource}>{d.source}</div>
      </div>

      <div className={styles.loadFooter}>
        <button className={styles.loadBtn} onClick={() => onLoad(d)}>
          ↓ Load Design
        </button>
        {isModified && (
          <span className={styles.loadNote}>
            Your current design has unsaved changes — loading will replace it.
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const ALL_TOPOLOGIES: TopologyId[] = ['buck', 'boost', 'buck-boost', 'flyback', 'forward', 'sepic']
const ALL_DIFFICULTIES: ReferenceDesign['difficulty'][] = ['beginner', 'intermediate', 'advanced']

export function DesignLibrary(): React.ReactElement | null {
  const isLibraryOpen   = useDesignStore(s => s.isLibraryOpen)
  const setIsLibraryOpen = useDesignStore(s => s.setIsLibraryOpen)
  const isModified       = useDesignStore(s => s.isModified)
  const loadDesignSpec   = useDesignStore(s => s.loadDesignSpec)

  const [search,     setSearch]     = useState('')
  const [topoFilter, setTopoFilter] = useState<TopologyId | 'all'>('all')
  const [diffFilter, setDiffFilter] = useState<ReferenceDesign['difficulty'] | 'all'>('all')
  const [selected,   setSelected]   = useState<ReferenceDesign | null>(null)

  // Escape key
  useEffect(() => {
    if (!isLibraryOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected) setSelected(null)
        else setIsLibraryOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isLibraryOpen, selected, setIsLibraryOpen])

  // Reset detail view when modal closes
  useEffect(() => {
    if (!isLibraryOpen) setSelected(null)
  }, [isLibraryOpen])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return REFERENCE_DESIGNS.filter(d => {
      if (topoFilter !== 'all' && d.topology !== topoFilter) return false
      if (diffFilter !== 'all' && d.difficulty !== diffFilter) return false
      if (q && !d.title.toLowerCase().includes(q) && !d.application.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [search, topoFilter, diffFilter])

  const handleLoad = useCallback((d: ReferenceDesign) => {
    if (isModified) {
      const ok = window.confirm('Your current design has unsaved changes. Load the reference design anyway?')
      if (!ok) return
    }
    loadDesignSpec(d.topology as TopologyId, d.spec)
    setIsLibraryOpen(false)
  }, [isModified, loadDesignSpec, setIsLibraryOpen])

  // All hooks before early return
  if (!isLibraryOpen) return null

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) setIsLibraryOpen(false) }}>
      <div className={styles.panel}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <span className={styles.headerIcon}>📚</span>
          <span className={styles.headerTitle}>Design Library</span>
          <span className={styles.headerSubtitle}>
            {REFERENCE_DESIGNS.length} reference designs — load any as a starting point
          </span>
          <button className={styles.headerClose} onClick={() => setIsLibraryOpen(false)}>×</button>
        </div>

        {selected ? (
          <DetailView
            design={selected}
            onBack={() => setSelected(null)}
            onLoad={handleLoad}
            isModified={isModified}
          />
        ) : (
          <>
            {/* ── Filter bar ── */}
            <div className={styles.filterBar}>
              <input
                className={styles.searchInput}
                placeholder="Search designs…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className={styles.filterDivider} />

              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Topology</span>
                <button
                  className={`${styles.pill} ${topoFilter === 'all' ? styles.active : ''}`}
                  onClick={() => setTopoFilter('all')}
                >All</button>
                {ALL_TOPOLOGIES.map(t => (
                  <button
                    key={t}
                    className={`${styles.pill} ${topoFilter === t ? styles.active : ''}`}
                    onClick={() => setTopoFilter(t)}
                    style={topoFilter === t ? { color: TOPO_COLOR[t]?.text, borderColor: TOPO_COLOR[t]?.text + '88', background: TOPO_COLOR[t]?.bg } : undefined}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <div className={styles.filterDivider} />

              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Level</span>
                <button className={`${styles.pill} ${diffFilter === 'all' ? styles.active : ''}`} onClick={() => setDiffFilter('all')}>All</button>
                {ALL_DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    className={`${styles.pill} ${diffFilter === d ? styles.active : ''}`}
                    onClick={() => setDiffFilter(d)}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>

              <span className={styles.countBadge}>{filtered.length} design{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* ── Grid ── */}
            <div className={styles.gridWrap}>
              {filtered.length === 0 ? (
                <div className={styles.emptyState}>No designs match the current filters</div>
              ) : (
                <div className={styles.grid}>
                  {filtered.map(d => (
                    <div
                      key={d.title}
                      className={`${styles.card} ${selected === d ? styles.selected : ''}`}
                      onClick={() => setSelected(d)}
                    >
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
        )}
      </div>
    </div>
  )
}
