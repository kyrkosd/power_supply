import React from 'react'
import { useDesignStore, type ActiveVizTab } from '../../store/design-store'
import { WaveformsTab } from './tabs/WaveformsTab'
import { BodeTab } from './tabs/BodeTab'
import { LossesTab } from './tabs/LossesTab'
import { ThermalTab } from './tabs/ThermalTab'
import styles from './TabPanel.module.css'

const TABS: { id: ActiveVizTab; label: string }[] = [
  { id: 'waveforms', label: 'Waveforms' },
  { id: 'bode',      label: 'Bode Plot' },
  { id: 'losses',    label: 'Losses' },
  { id: 'thermal',   label: 'Thermal' }
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
        {activeVizTab === 'thermal'   && <ThermalTab />}
      </div>
    </div>
  )
}
