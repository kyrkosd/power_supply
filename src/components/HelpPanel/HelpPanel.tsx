// Help & documentation panel: toggle button, tabbed shell, keyboard open/close.
import React, { useState, useCallback } from 'react'
import { QuickStartTab, ResultsTab, ShortcutsTab, tabLabel, type TabId } from './helpPanelTabs'
import { ChartsTab }     from './helpPanelCharts'
import { TopologiesTab } from './helpPanelTopologies'
import { usePanelKeyboard, useOutsideClick } from './helpPanelUtils'
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
 * Opens with the "?" button or "?" key; closes with Escape or an outside click.
 */
export function HelpPanel(): React.ReactElement {
  const [isOpen, setIsOpen]       = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('quickstart')

  const open  = useCallback(() => setIsOpen(true),  [])
  const close = useCallback(() => setIsOpen(false), [])

  usePanelKeyboard(isOpen, open, close)
  useOutsideClick(isOpen, 'help-panel', 'help-btn', close)

  const ActiveTab = TAB_COMPONENTS[activeTab]

  return (
    <>
      <button id="help-btn" className={styles.helpBtn}
        onClick={() => setIsOpen((v) => !v)} title="Help & documentation (?)">
        ?
      </button>

      {isOpen && (
        <div id="help-panel" className={styles.panel}>
          <div className={styles.header}>
            <h2>Help &amp; Documentation</h2>
            <button className={styles.closeBtn} onClick={close}>✕</button>
          </div>
          <div className={styles.tabBar}>
            {TAB_IDS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}>
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
