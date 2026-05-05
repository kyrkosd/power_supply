// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React from 'react'
import { useDesignStore, type ActiveVizTab } from '../../store/design-store'
import { WaveformsTab } from './tabs/WaveformsTab'
import { BodeTab } from './tabs/BodeTab'
import { LossesTab } from './tabs/LossesTab'
import { ThermalTab } from './tabs/ThermalTab'
import { MonteCarloTab } from './tabs/MonteCarloTab'
import { EfficiencyMapTab } from './tabs/EfficiencyMapTab'
import { LayoutTab } from './tabs/LayoutTab'
import styles from './TabPanel.module.css'

const TABS: { id: ActiveVizTab; label: string }[] = [
  { id: 'waveforms',      label: 'Waveforms' },
  { id: 'bode',           label: 'Bode Plot' },
  { id: 'losses',         label: 'Losses' },
  { id: 'thermal',        label: 'Thermal' },
  { id: 'monte-carlo',    label: 'Monte Carlo' },
  { id: 'efficiency-map', label: 'Efficiency Map' },
  { id: 'layout',         label: 'Layout' },
]

export function TabPanel(): React.ReactElement {
  const { activeVizTab, setActiveVizTab } = useDesignStore()

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeVizTab === t.id ? styles.active : ''}`}
            onClick={() => setActiveVizTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className={styles.tabBarFill} />
      </div>
      <div className={styles.tabContent}>
        {activeVizTab === 'waveforms' && <WaveformsTab />}
        {activeVizTab === 'bode'      && <BodeTab />}
        {activeVizTab === 'losses'    && <LossesTab />}
        {activeVizTab === 'thermal'      && <ThermalTab />}
        {activeVizTab === 'monte-carlo'    && <MonteCarloTab />}
        {activeVizTab === 'efficiency-map' && <EfficiencyMapTab />}
        {activeVizTab === 'layout'         && <LayoutTab />}
      </div>
    </div>
  )
}
