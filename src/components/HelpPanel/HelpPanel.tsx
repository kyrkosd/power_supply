// Help & documentation panel: toggle button, tabbed shell, keyboard open/close.
import React, { useState, useEffect } from 'react'
import { QuickStartTab, ResultsTab, ShortcutsTab, tabLabel, type TabId } from './helpPanelTabs'
import { ChartsTab }     from './helpPanelCharts'
import { TopologiesTab } from './helpPanelTopologies'
import styles from './HelpPanel.module.css'

const TAB_IDS: TabId[] = ['quickstart', 'results', 'charts', 'topologies', 'shortcuts']

/** Maps each tab id to its content component for O(1) lookup. */
const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  quickstart: QuickStartTab,
  results:    ResultsTab,
  charts:     ChartsTab,
  topologies: TopologiesTab,
  shortcuts:  ShortcutsTab,
}

/**
 * Collapsible help panel rendered inside the overflow toolbar menu.
 * Opens with the "?" button or the "?" key; closes with Escape or an outside click.
 */
export function HelpPanel(): React.ReactElement {
  const [isOpen, setIsOpen]     = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('quickstart')

  // Keyboard: "?" opens, Escape closes; ignores text inputs
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape' && isOpen)  { setIsOpen(false); return }
      if (e.key === '?' && !isOpen)      { e.preventDefault(); setIsOpen(true) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  // Close on outside click when panel is open
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      const panel = document.getElementById('help-panel')
      const btn   = document.getElementById('help-btn')
      if (panel && !panel.contains(e.target as Node) && btn && !btn.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isOpen])

  const ActiveTab = TAB_COMPONENTS[activeTab]

  return (
    <>
      <button
        id="help-btn"
        className={styles.helpBtn}
        onClick={() => setIsOpen((v) => !v)}
        title="Help & documentation (?)"
      >
        ?
      </button>

      {isOpen && (
        <div id="help-panel" className={styles.panel}>
          <div className={styles.header}>
            <h2>Help &amp; Documentation</h2>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div className={styles.tabBar}>
            {TAB_IDS.map((tab) => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>

          <div className={styles.content}>
            <ActiveTab />
          </div>
        </div>
      )}
    </>
  )
}
