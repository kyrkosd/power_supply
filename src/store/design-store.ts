import { create } from 'zustand'
import type { DesignSpec, DesignResult } from '../engine/types'
import type { WaveformSet } from '../engine/topologies/types'
import type { TopologyId } from './workbenchStore'
import type { MonteCarloResult } from '../engine/monte-carlo'

export type { TopologyId } from './workbenchStore'
export type ActiveVizTab = 'waveforms' | 'bode' | 'losses' | 'thermal' | 'monte-carlo'

export interface DesignStoreState {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult | null
  waveforms: WaveformSet | null
  mcResult: MonteCarloResult | null
  activeVizTab: ActiveVizTab
  isComputing: boolean

  setTopology: (topology: TopologyId) => void
  updateSpec: (updates: Partial<DesignSpec>) => void
  resetSpec: () => void
  setResult: (result: DesignResult | null, waveforms: WaveformSet | null) => void
  setMcResult: (mcResult: MonteCarloResult | null) => void
  setActiveVizTab: (tab: ActiveVizTab) => void
}

const TOPOLOGY_DEFAULTS: Record<TopologyId, DesignSpec> = {
  buck: {
    vinMin: 10, vinMax: 15, vout: 5, iout: 2,
    fsw: 200_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.01, efficiency: 0.9,
  },
  boost: {
    vinMin: 5, vinMax: 8, vout: 12, iout: 1,
    fsw: 200_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.05, efficiency: 0.9,
  },
  'buck-boost': {
    vinMin: 5, vinMax: 15, vout: 9, iout: 1,
    fsw: 200_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.05, efficiency: 0.85,
  },
  flyback: {
    vinMin: 36, vinMax: 72, vout: 12, iout: 2,
    fsw: 100_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.1, efficiency: 0.85,
  },
  forward: {
    vinMin: 36, vinMax: 72, vout: 12, iout: 3,
    fsw: 100_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.1, efficiency: 0.88,
  },
  sepic: {
    vinMin: 6, vinMax: 14, vout: 9, iout: 1,
    fsw: 200_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.05, efficiency: 0.88,
  },
}

const defaultSpec: DesignSpec = TOPOLOGY_DEFAULTS['buck']

export const useDesignStore = create<DesignStoreState>((set) => ({
  topology: 'buck',
  spec: defaultSpec,
  result: null,
  waveforms: null,
  mcResult: null,
  activeVizTab: 'waveforms',
  isComputing: false,

  setTopology: (topology) =>
    set({ topology, spec: TOPOLOGY_DEFAULTS[topology], result: null, waveforms: null, mcResult: null, isComputing: true }),

  updateSpec: (updates) =>
    set((state) => ({
      spec: { ...state.spec, ...updates },
      result: null,
      waveforms: null,
      mcResult: null,
      isComputing: true,
    })),

  resetSpec: () =>
    set((state) => ({
      spec: TOPOLOGY_DEFAULTS[state.topology],
      result: null,
      waveforms: null,
      mcResult: null,
      isComputing: true,
    })),

  setResult: (result, waveforms) =>
    set({ result, waveforms, isComputing: false }),

  setMcResult: (mcResult) =>
    set({ mcResult, isComputing: false }),

  setActiveVizTab: (activeVizTab) => set({ activeVizTab }),
}))
