import React from 'react'
import { useDesignStore, type ActiveVizTab } from '../../store/design-store'
import { WaveformsTab } from './tabs/WaveformsTab'
import { BodeTab } from './tabs/BodeTab'
import { LossesTab } from './tabs/LossesTab'
import { ThermalTab } from './tabs/ThermalTab'
import { MonteCarloTab } from './tabs/MonteCarloTab'
import { EfficiencyMapTab } from './tabs/EfficiencyMapTab'
import { LayoutTab } from './tabs/LayoutTab'
import { TransientTab } from './tabs/TransientTab'
import { InputFilterTab } from './tabs/InputFilterTab'
import { ResultsTable } from '../ResultsTable/ResultsTable'
import styles from './TabPanel.module.css'

// ── Grouped icon navigation definition ───────────────────────────────────────

interface TabDef {
  id: ActiveVizTab
  icon: string
  label: string
  title: string
}

interface TabGroup {
  label: string
  tabs: TabDef[]
}

const TAB_GROUPS: TabGroup[] = [
  {
    label: 'Analysis',
    tabs: [
      { id: 'waveforms',      icon: '∿',  label: 'Waves',    title: 'Waveforms' },
      { id: 'bode',           icon: '∠',  label: 'Bode',     title: 'Bode Plot' },
      { id: 'losses',         icon: '∑',  label: 'Losses',   title: 'Loss Breakdown' },
      { id: 'thermal',        icon: '⊡',  label: 'Thermal',  title: 'Thermal Analysis' },
    ],
  },
  {
    label: 'Verification',
    tabs: [
      { id: 'monte-carlo',    icon: 'σ',  label: 'MC',       title: 'Monte Carlo' },
      { id: 'transient',      icon: '∫',  label: 'Transient',title: 'Transient Simulation' },
      { id: 'input-filter',   icon: '≫',  label: 'Filter',   title: 'Input EMI Filter' },
    ],
  },
  {
    label: 'Design Aids',
    tabs: [
      { id: 'efficiency-map', icon: 'η',  label: 'Efficiency',title: 'Efficiency Heatmap' },
      { id: 'layout',         icon: '⊟',  label: 'Layout',   title: 'PCB Layout Guide' },
      { id: 'results',        icon: '≡',  label: 'Results',  title: 'Full Results Table' },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function TabPanel(): React.ReactElement {
  const { activeVizTab, setActiveVizTab } = useDesignStore()

  return (
    <div className={styles.panel}>
      {/* Grouped icon nav bar */}
      <div className={styles.iconNav}>
        {TAB_GROUPS.map((group) => (
          <div className={styles.navGroup} key={group.label}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.groupItems}>
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`${styles.navBtn} ${activeVizTab === tab.id ? styles.active : ''}`}
                  onClick={() => setActiveVizTab(tab.id)}
                  title={tab.title}
                >
                  <span className={styles.navIcon}>{tab.icon}</span>
                  <span className={styles.navLabel}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>
        {activeVizTab === 'waveforms'      && <WaveformsTab />}
        {activeVizTab === 'bode'           && <BodeTab />}
        {activeVizTab === 'losses'         && <LossesTab />}
        {activeVizTab === 'thermal'        && <ThermalTab />}
        {activeVizTab === 'transient'      && <TransientTab />}
        {activeVizTab === 'monte-carlo'    && <MonteCarloTab />}
        {activeVizTab === 'efficiency-map' && <EfficiencyMapTab />}
        {activeVizTab === 'input-filter'   && <InputFilterTab />}
        {activeVizTab === 'layout'         && <LayoutTab />}
        {activeVizTab === 'results'        && <ResultsTable />}
      </div>
    </div>
  )
}
