// Grouped icon navigation sidebar + tab content area.
// TAB_COMPONENTS map eliminates the per-tab conditional chain.

import React from 'react'
import { useDesignStore, type ActiveVizTab } from '../../store/design-store'
import { WaveformsTab }    from './tabs/WaveformsTab'
import { BodeTab }         from './tabs/BodeTab'
import { LossesTab }       from './tabs/LossesTab'
import { ThermalTab }      from './tabs/ThermalTab'
import { MonteCarloTab }   from './tabs/MonteCarloTab'
import { EfficiencyMapTab } from './tabs/EfficiencyMapTab'
import { LayoutTab }       from './tabs/LayoutTab'
import { TransientTab }    from './tabs/TransientTab'
import { InputFilterTab }  from './tabs/InputFilterTab'
import { ResultsTable }    from '../ResultsTable/ResultsTable'
import styles from './TabPanel.module.css'

// ── Static navigation structure ───────────────────────────────────────────────

interface TabDef   { id: ActiveVizTab; icon: string; label: string; title: string }
interface TabGroup { label: string; tabs: TabDef[] }

const TAB_GROUPS: TabGroup[] = [
  {
    label: 'Analysis',
    tabs: [
      { id: 'waveforms', icon: '∿', label: 'Waves',   title: 'Waveforms' },
      { id: 'bode',      icon: '∠', label: 'Bode',    title: 'Bode Plot' },
      { id: 'losses',    icon: '∑', label: 'Losses',  title: 'Loss Breakdown' },
      { id: 'thermal',   icon: '⊡', label: 'Thermal', title: 'Thermal Analysis' },
    ],
  },
  {
    label: 'Verification',
    tabs: [
      { id: 'monte-carlo',  icon: 'σ', label: 'MC',        title: 'Monte Carlo' },
      { id: 'transient',    icon: '∫', label: 'Transient',  title: 'Transient Simulation' },
      { id: 'input-filter', icon: '≫', label: 'Filter',    title: 'Input EMI Filter' },
    ],
  },
  {
    label: 'Design Aids',
    tabs: [
      { id: 'efficiency-map', icon: 'η', label: 'Efficiency', title: 'Efficiency Heatmap' },
      { id: 'layout',         icon: '⊟', label: 'Layout',    title: 'PCB Layout Guide' },
      { id: 'results',        icon: '≡', label: 'Results',   title: 'Full Results Table' },
    ],
  },
]

/** Maps each tab id directly to its content component — O(1) lookup, zero conditional branches. */
const TAB_COMPONENTS: Record<ActiveVizTab, React.ComponentType> = {
  waveforms:        WaveformsTab,
  bode:             BodeTab,
  losses:           LossesTab,
  thermal:          ThermalTab,
  transient:        TransientTab,
  'monte-carlo':    MonteCarloTab,
  'efficiency-map': EfficiencyMapTab,
  'input-filter':   InputFilterTab,
  layout:           LayoutTab,
  results:          ResultsTable,
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Single icon navigation button for one tab. */
function NavButton(
  { tab, active, onClick }: { tab: TabDef; active: boolean; onClick: () => void },
): React.ReactElement {
  return (
    <button
      className={`${styles.navBtn} ${active ? styles.active : ''}`}
      onClick={onClick}
      title={tab.title}
    >
      <span className={styles.navIcon}>{tab.icon}</span>
      <span className={styles.navLabel}>{tab.label}</span>
    </button>
  )
}

// ── TabPanel ──────────────────────────────────────────────────────────────────

/** Grouped icon navigation sidebar paired with the active tab's content panel. */
export function TabPanel(): React.ReactElement {
  const { activeVizTab, setActiveVizTab } = useDesignStore()
  const ActiveComponent = TAB_COMPONENTS[activeVizTab]

  return (
    <div className={styles.panel}>
      <div className={styles.iconNav}>
        {TAB_GROUPS.map((group) => (
          <div className={styles.navGroup} key={group.label}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.groupItems}>
              {group.tabs.map((tab) => (
                <NavButton
                  key={tab.id}
                  tab={tab}
                  active={activeVizTab === tab.id}
                  onClick={() => setActiveVizTab(tab.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.tabContent}>
        <ActiveComponent />
      </div>
    </div>
  )
}
