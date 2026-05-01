import { create } from 'zustand'
import type { DesignSpec, DesignResult } from '../engine/types'
import type { WaveformSet } from '../engine/topologies/types'
import type { TopologyId } from './workbenchStore'
import type { MonteCarloResult } from '../engine/monte-carlo'
import type { TransientResult } from '../engine/topologies/types'
import type { EMIResult } from '../engine/topologies/types'

export type { TopologyId } from './workbenchStore'
export type ActiveVizTab = 'waveforms' | 'bode' | 'losses' | 'thermal' | 'monte-carlo' | 'ltspice-comparison' | 'transient' | 'emi'

export interface MCRunRequest {
  iterations: number
  seed: number
  computePhaseMargin: boolean
}

export interface DesignStoreState {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult | null
  waveforms: WaveformSet | null
  mcResult: MonteCarloResult | null
  mcRunRequest: MCRunRequest | null
  transientResult: TransientResult | null
  emiResult: EMIResult | null
  activeVizTab: ActiveVizTab
  isComputing: boolean
  computeTimeMs: number | null

  setTopology: (topology: TopologyId) => void
  updateSpec: (updates: Partial<DesignSpec>) => void
  resetSpec: () => void
  setResult: (result: DesignResult | null, waveforms: WaveformSet | null, computeTimeMs?: number) => void
  setMcResult: (mcResult: MonteCarloResult | null) => void
  requestMcRun: (req: MCRunRequest) => void
  clearMcRunRequest: () => void
  setTransientResult: (res: TransientResult | null) => void
  setEmiResult: (res: EMIResult | null) => void
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
  mcRunRequest: null,
  transientResult: null,
  emiResult: null,
  activeVizTab: 'waveforms',
  isComputing: false,

  setTopology: (topology) =>
    set({ topology, spec: TOPOLOGY_DEFAULTS[topology], result: null, waveforms: null, mcResult: null, transientResult: null, emiResult: null, isComputing: true }),

  updateSpec: (updates) =>
    set((state) => ({
      spec: { ...state.spec, ...updates },
      result: null,
      waveforms: null,
      mcResult: null,
      transientResult: null,
      emiResult: null,
      isComputing: true,
    })),

  resetSpec: () =>
    set((state) => ({
      spec: TOPOLOGY_DEFAULTS[state.topology],
      result: null,
      waveforms: null,
      mcResult: null,
      transientResult: null,
      emiResult: null,
      isComputing: true,
    })),

  setResult: (result, waveforms) =>
    set({ result, waveforms, isComputing: false }),

  setMcResult: (mcResult) =>
    set({ mcResult, isComputing: false }),

  requestMcRun: (req) => set({ mcRunRequest: req }),
  clearMcRunRequest: () => set({ mcRunRequest: null }),

  setTransientResult: (transientResult) =>
    set({ transientResult }),

  setEmiResult: (emiResult) =>
    set({ emiResult }),

  setActiveVizTab: (activeVizTab) => set({ activeVizTab }),
}))
