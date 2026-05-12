// Badge, spec grid, and detail-view sub-components for the Design Library modal.
import React from 'react'
import type { ReferenceDesign } from '../../data/reference-designs/index'
import styles from './DesignLibrary.module.css'

// ── Badge color map ───────────────────────────────────────────────────────────

/** Per-topology background and text colors for topology pills. */
export const TOPO_COLOR: Record<string, { bg: string; text: string }> = {
  'buck':       { bg: 'rgba(50, 201, 230, 0.15)',  text: '#32c9e6' },
  'boost':      { bg: 'rgba(34, 197, 94, 0.15)',   text: '#22c55e' },
  'buck-boost': { bg: 'rgba(245, 158, 11, 0.15)',  text: '#f59e0b' },
  'flyback':    { bg: 'rgba(167, 139, 250, 0.15)', text: '#a78bfa' },
  'forward':    { bg: 'rgba(56, 189, 248, 0.15)',  text: '#38bdf8' },
  'sepic':      { bg: 'rgba(249, 115, 22, 0.15)',  text: '#f97316' },
}

/** Colored pill showing the topology name in uppercase. */
export function TopoBadge({ topo }: { topo: string }): React.ReactElement {
  const c = TOPO_COLOR[topo] ?? { bg: 'rgba(255,255,255,0.08)', text: '#94a3b8' }
  return (
    <span className={styles.topoBadge} style={{ background: c.bg, color: c.text }}>
      {topo.toUpperCase()}
    </span>
  )
}

/** Colored difficulty badge: beginner / intermediate / advanced. */
export function DiffBadge({ diff }: { diff: ReferenceDesign['difficulty'] }): React.ReactElement {
  const cls = diff === 'beginner' ? styles.diffBeginner
    : diff === 'intermediate' ? styles.diffIntermediate : styles.diffAdvanced
  return (
    <span className={`${styles.diffBadge} ${cls}`}>
      {diff.charAt(0).toUpperCase() + diff.slice(1)}
    </span>
  )
}

// ── Spec grid ─────────────────────────────────────────────────────────────────

/** Six-cell summary grid showing Vin, Vout, Iout, Power, fsw, and efficiency target. */
export function SpecGrid({ d }: { d: ReferenceDesign }): React.ReactElement {
  const s = d.spec
  const cells = [
    { label: 'Vin',      value: s.vinMin === s.vinMax ? `${s.vinMin} V` : `${s.vinMin}–${s.vinMax} V` },
    { label: 'Vout',     value: `${s.vout} V` },
    { label: 'Iout',     value: `${s.iout} A` },
    { label: 'Power',    value: `${(s.vout * s.iout).toFixed(0)} W` },
    { label: 'fsw',      value: s.fsw >= 1e6 ? `${(s.fsw / 1e6).toFixed(1)} MHz` : `${(s.fsw / 1e3).toFixed(0)} kHz` },
    { label: 'Target η', value: `${(s.efficiency * 100).toFixed(0)} %` },
  ]
  return (
    <div className={styles.specGrid}>
      {cells.map((c) => (
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
  design:     ReferenceDesign
  onBack:     () => void
  onLoad:     (d: ReferenceDesign) => void
  isModified: boolean
}

/**
 * Full detail panel for a selected reference design.
 * Shows overview, spec grid, design notes, reference citation, and a load button.
 */
export function DetailView({ design: d, onBack, onLoad, isModified }: DetailProps): React.ReactElement {
  return (
    <div className={styles.detailWrap}>
      <button className={styles.detailBack} onClick={onBack}>← Back to library</button>

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
        <button className={styles.loadBtn} onClick={() => onLoad(d)}>↓ Load Design</button>
        {isModified && (
          <span className={styles.loadNote}>
            Your current design has unsaved changes — loading will replace it.
          </span>
        )}
      </div>
    </div>
  )
}
