import { create } from 'zustand'

export type TopologyId = 'buck' | 'boost' | 'buck-boost' | 'flyback' | 'forward' | 'sepic'

export type ActiveTab = 'waveforms' | 'bode' | 'losses' | 'thermal'

export interface DesignInputs {
  vinMin: number   // V
  vinMax: number   // V
  vout: number     // V
  iout: number     // A
  fsw: number      // Hz
  efficiency: number // 0–1
}

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

  setTopology: (t: TopologyId) => void
  setInput: <K extends keyof DesignInputs>(key: K, value: DesignInputs[K]) => void
  setResults: (r: Partial<DesignResults>) => void
  setActiveTab: (tab: ActiveTab) => void
}

const defaultInputs: DesignInputs = {
  vinMin: 10,
  vinMax: 15,
  vout: 5,
  iout: 2,
  fsw: 200_000,
  efficiency: 0.9
}

const emptyResults: DesignResults = {
  dutyCycle: null,
  inductance: null,
  capacitance: null,
  peakCurrent: null
}

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

  setActiveTab: (activeTab) => set({ activeTab })
}))
