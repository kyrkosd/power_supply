import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TopologyId = 'buck' | 'boost' | 'buck-boost' | 'flyback' | 'forward' | 'sepic'

export type ActiveTab =
  | 'waveforms' | 'bode' | 'losses' | 'thermal'
  | 'monte-carlo' | 'ltspice-comparison' | 'transient' | 'emi'

/** Raw input parameters collected from the design form. All values in SI base units. */
export interface DesignInputs {
  vinMin: number      // V
  vinMax: number      // V
  vout: number        // V
  iout: number        // A
  fsw: number         // Hz
  efficiency: number  // 0–1
}

/** Computed results derived from DesignInputs by the active topology engine. */
export interface DesignResults {
  dutyCycle: number | null
  inductance: number | null   // H
  capacitance: number | null  // F
  peakCurrent: number | null  // A
}

interface WorkbenchState {
  topology: TopologyId
  inputs: DesignInputs
  results: DesignResults
  activeTab: ActiveTab

  /** Switch topology and clear stale results. */
  setTopology: (t: TopologyId) => void
  /** Update a single input field and clear stale results. */
  setInput: <K extends keyof DesignInputs>(key: K, value: DesignInputs[K]) => void
  /** Merge partial computed results into the results slice. */
  setResults: (r: Partial<DesignResults>) => void
  /** Switch the active visualisation tab. */
  setActiveTab: (tab: ActiveTab) => void
}

// ── Initial state ─────────────────────────────────────────────────────────────

const defaultInputs: DesignInputs = {
  vinMin: 10,
  vinMax: 15,
  vout: 5,
  iout: 2,
  fsw: 200_000,
  efficiency: 0.9,
}

const emptyResults: DesignResults = {
  dutyCycle: null,
  inductance: null,
  capacitance: null,
  peakCurrent: null,
}

// ── Store ─────────────────────────────────────────────────────────────────────

/** Legacy thin store — preserved for backward compatibility with early worker prototypes. */
export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  topology: 'buck',
  inputs: defaultInputs,
  results: emptyResults,
  activeTab: 'waveforms',

  setTopology: (topology) => set({ topology, results: emptyResults }),

  setInput: (key, value) =>
    set((s) => ({ inputs: { ...s.inputs, [key]: value }, results: emptyResults })),

  setResults: (r) =>
    set((s) => ({ results: { ...s.results, ...r } })),

  setActiveTab: (activeTab) => set({ activeTab }),
}))
