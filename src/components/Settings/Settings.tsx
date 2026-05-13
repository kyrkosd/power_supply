// Settings modal: community plugins management.
import React, { useEffect } from 'react'
import { useDesignStore } from '../../store/design-store'
import { PluginsSection } from './settingsSections'
import styles from './Settings.module.css'

/**
 * Settings modal — opens via Ctrl+, or toolbar gear button.
 * Closes on Escape or backdrop click.
 * Child sections own their own local state; they mount fresh on each open
 * because this component returns null when closed.
 */
export function Settings(): React.ReactElement | null {
  const isOpen    = useDesignStore((s) => s.isSettingsOpen)
  const setIsOpen = useDesignStore((s) => s.setIsSettingsOpen)

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={() => setIsOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
        </div>

        <PluginsSection />
      </div>
    </div>
  )
}
