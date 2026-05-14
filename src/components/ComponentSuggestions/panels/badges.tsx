// Tiny shared UI atoms used by every suggestion panel.
import React from 'react'
import { Tooltip } from '../../Tooltip/Tooltip'
import styles from '../ComponentSuggestions.module.css'

/** Green "✓ selected" pill shown beside any section header when the part is active. */
export function selectBadge(isSelected: boolean): React.ReactElement | null {
  if (!isSelected) return null
  return (
    <span style={{ fontSize: '10px', background: '#1a4a2e', color: '#4ade80', borderRadius: '3px', padding: '1px 5px', marginLeft: '6px' }}>
      ✓ selected
    </span>
  )
}

/** Yes / No badge pill with pass/fail colour. */
export function YesNo({ ok, label }: { ok: boolean; label: string }): React.ReactElement {
  return <span className={ok ? styles.ssBadgeOk : styles.ssBadgeWarn}>{ok ? `✓ ${label}` : `✗ ${label}`}</span>
}

/** A labelled row inside the Gate Drive `<details>` panel with an info tooltip. */
export function GdrRow({ label, value, tip }: { label: string; value: string; tip: React.ReactNode }): React.ReactElement {
  return (
    <div className={styles.gdrRow}>
      <span className={styles.gdrLabel}>
        {label}
        <Tooltip content={tip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip>
      </span>
      <span className={styles.gdrValue}>{value}</span>
    </div>
  )
}
