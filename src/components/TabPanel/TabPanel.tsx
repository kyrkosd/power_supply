// Grouped icon navigation sidebar + tab content area.
import React from 'react'
import { useDesignStore, type ActiveVizTab } from '../../store/design-store'
import { WaveformsTab }     from './tabs/WaveformsTab'
import { BodeTab }          from './tabs/BodeTab'
import { LossesTab }        from './tabs/LossesTab'
import { ThermalTab }       from './tabs/ThermalTab'
import { MonteCarloTab }    from './tabs/MonteCarloTab'
import { EfficiencyMapTab } from './tabs/EfficiencyMapTab'
import { LayoutTab }        from './tabs/LayoutTab'
import { TransientTab }     from './tabs/TransientTab'
import { InputFilterTab }   from './tabs/InputFilterTab'
import { EMITab }           from './tabs/EMITab'
import { ResultsTable }     from '../ResultsTable/ResultsTable'
import { TAB_GROUPS, type TabDef, type TabGroup } from './tabPanelDefs'
import styles from './TabPanel.module.css'

/** Maps each tab id directly to its content component — O(1) lookup, zero conditional branches. */
const TAB_COMPONENTS: Record<ActiveVizTab, React.ComponentType> = {
  waveforms:             WaveformsTab,
  bode:                  BodeTab,
  losses:                LossesTab,
  thermal:               ThermalTab,
  transient:             TransientTab,
  'monte-carlo':         MonteCarloTab,
  'efficiency-map':      EfficiencyMapTab,
  'input-filter':        InputFilterTab,
  emi:                   EMITab,
  layout:                LayoutTab,
  results:               ResultsTable,
  'ltspice-comparison':  ResultsTable,  // LTspice overlay is launched as a modal; fallback to results view
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Single icon navigation button for one tab entry. */
function NavButton({ tab, active, onClick }: { tab: TabDef; active: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button className={`${styles.navBtn} ${active ? styles.active : ''}`}
      onClick={onClick} title={tab.title}>
      <span className={styles.navIcon}>{tab.icon}</span>
      <span className={styles.navLabel}>{tab.label}</span>
    </button>
  )
}

/** Renders one labeled group with its nav buttons. */
function NavGroup({ group, activeTab, onSelect }: {
  group: TabGroup; activeTab: ActiveVizTab; onSelect: (id: ActiveVizTab) => void
}): React.ReactElement {
  return (
    <div className={styles.navGroup}>
      <span className={styles.groupLabel}>{group.label}</span>
      <div className={styles.groupItems}>
        {group.tabs.map((tab) => (
          <NavButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => onSelect(tab.id)} />
        ))}
      </div>
    </div>
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
        {TAB_GROUPS.map((g) => (
          <NavGroup key={g.label} group={g} activeTab={activeVizTab} onSelect={setActiveVizTab} />
        ))}
      </div>
      <div className={styles.tabContent}>
        <ActiveComponent />
      </div>
    </div>
  )
}
