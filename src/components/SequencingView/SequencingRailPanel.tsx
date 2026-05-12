// Rail card list, manual-entry form, and add/reset-order controls for SequencingView.
import React from 'react'
import type { SequencingRail } from '../../engine/sequencing'
import styles from './SequencingView.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Manual rail entry form fields (all strings for controlled inputs). */
export interface ManualForm { name: string; vout: string; tss_ms: string }

/** Blank form initial state. */
export const EMPTY_FORM: ManualForm = { name: '', vout: '3.3', tss_ms: '5' }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formats a time in seconds to a human-readable string (ms or µs). */
function fmtMs(s: number): string {
  const ms = s * 1000
  return ms >= 1 ? `${ms.toFixed(1)} ms` : `${(ms * 1000).toFixed(0)} µs`
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SequencingRailPanelProps {
  rails:              SequencingRail[]
  conflictedNames:    Set<string>
  showManual:         boolean
  form:               ManualForm
  matchesRecommended: boolean
  onMoveRail:         (id: string, dir: -1 | 1) => void
  onRemoveRail:       (id: string) => void
  onFormChange:       (f: ManualForm) => void
  onAddManual:        () => void
  onLoadFile:         () => void
  onToggleManual:     (v: boolean) => void
  onResetOrder:       () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Left panel of the sequencing modal: displays rail cards with up/down reorder
 * buttons, a manual-entry form, and + From File / + Manual action buttons.
 */
export function SequencingRailPanel(props: SequencingRailPanelProps): React.ReactElement {
  const {
    rails, conflictedNames, showManual, form, matchesRecommended,
    onMoveRail, onRemoveRail, onFormChange, onAddManual, onLoadFile,
    onToggleManual, onResetOrder,
  } = props

  return (
    <div className={styles.leftPanel}>
      <div className={styles.railList}>
        {rails.length === 0 && (
          <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Add rails using the buttons below. Load from a <strong>.pswb</strong> project file or enter values manually.
          </div>
        )}

        {rails.map((rail, i) => (
          <div
            key={rail.id}
            className={`${styles.railCard} ${conflictedNames.has(rail.name) ? styles.railCardConflict : ''}`}
          >
            <div className={styles.railCardRow}>
              <span className={styles.railName} title={rail.name}>{rail.name}</span>
              <span className={styles.railVout}>{rail.vout} V</span>
              <div className={styles.orderBtns}>
                <button className={styles.orderBtn} onClick={() => onMoveRail(rail.id, -1)}
                  disabled={i === 0} title="Move up">↑</button>
                <button className={styles.orderBtn} onClick={() => onMoveRail(rail.id, 1)}
                  disabled={i === rails.length - 1} title="Move down">↓</button>
              </div>
              <button className={styles.removeBtn} onClick={() => onRemoveRail(rail.id)} title="Remove rail">×</button>
            </div>
            <div className={styles.railMeta}>
              <span>tss: {fmtMs(rail.tss)}</span>
              <span>PG: {fmtMs(rail.pg_delay)}</span>
            </div>
            <div className={styles.railSource}>
              {rail.spec ? 'loaded from file' : 'manual entry'}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.railActions}>
        {showManual && (
          <div className={styles.manualForm}>
            <div className={styles.formRow}>
              <span className={styles.formLabel}>Name</span>
              <input className={styles.formInput} placeholder="e.g. VDD_CORE"
                value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} />
            </div>
            <div className={styles.formRow}>
              <span className={styles.formLabel}>Vout</span>
              <input className={styles.formInput} type="number" min="0.1" max="100" step="0.1"
                value={form.vout} onChange={(e) => onFormChange({ ...form, vout: e.target.value })} />
              <span className={styles.formUnit}>V</span>
            </div>
            <div className={styles.formRow}>
              <span className={styles.formLabel}>Soft-start</span>
              <input className={styles.formInput} type="number" min="0.1" max="500" step="0.1"
                value={form.tss_ms} onChange={(e) => onFormChange({ ...form, tss_ms: e.target.value })} />
              <span className={styles.formUnit}>ms</span>
            </div>
            <div className={styles.formActions}>
              <button className={styles.formCancelBtn}
                onClick={() => { onToggleManual(false); onFormChange(EMPTY_FORM) }}>Cancel</button>
              <button className={styles.formAddBtn} onClick={onAddManual}>Add Rail</button>
            </div>
          </div>
        )}

        {!showManual && (
          <div className={styles.actionRow}>
            <button className={styles.addBtn} onClick={onLoadFile}
              disabled={rails.length >= 8} title="Open a .pswb project file">+ From File</button>
            <button className={styles.addBtn} onClick={() => onToggleManual(true)}
              disabled={rails.length >= 8}>+ Manual</button>
          </div>
        )}

        {!matchesRecommended && rails.length > 1 && !showManual && (
          <button className={styles.resetOrderBtn} onClick={onResetOrder}>
            Reset to recommended order
          </button>
        )}
      </div>
    </div>
  )
}
