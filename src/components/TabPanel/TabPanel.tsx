import React from 'react'
import { useWorkbenchStore, ActiveTab } from '../../store/workbenchStore'
import { WaveformsTab } from './tabs/WaveformsTab'
import { BodeTab } from './tabs/BodeTab'
import { LossesTab } from './tabs/LossesTab'
import { ThermalTab } from './tabs/ThermalTab'
import styles from './TabPanel.module.css'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'waveforms', label: 'Waveforms' },
  { id: 'bode',      label: 'Bode Plot' },
  { id: 'losses',    label: 'Losses' },
  { id: 'thermal',   label: 'Thermal' }
]

export function TabPanel(): React.ReactElement {
  const { activeTab, setActiveTab } = useWorkbenchStore()

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.active : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className={styles.tabBarFill} />
      </div>
      <div className={styles.tabContent}>
        {activeTab === 'waveforms' && <WaveformsTab />}
        {activeTab === 'bode'      && <BodeTab />}
        {activeTab === 'losses'    && <LossesTab />}
        {activeTab === 'thermal'   && <ThermalTab />}
      </div>
    </div>
  )
}
