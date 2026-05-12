// Static navigation structure definitions for the TabPanel sidebar.
import type { ActiveVizTab } from '../../store/design-store'

/** Definition for a single icon navigation button. */
export interface TabDef { id: ActiveVizTab; icon: string; label: string; title: string }

/** A labeled group of tab buttons in the icon sidebar. */
export interface TabGroup { label: string; tabs: TabDef[] }

/** Grouped tab navigation structure rendered by the TabPanel sidebar. */
export const TAB_GROUPS: TabGroup[] = [
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
      { id: 'monte-carlo',  icon: 'σ', label: 'MC',       title: 'Monte Carlo' },
      { id: 'transient',    icon: '∫', label: 'Transient', title: 'Transient Simulation' },
      { id: 'input-filter', icon: '≫', label: 'Filter',   title: 'Input EMI Filter' },
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
