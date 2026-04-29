import { create } from 'zustand'
import type { DesignSpec, DesignResult } from '../engine/types'
import type { WaveformSet } from '../engine/topologies/types'
import type { TopologyId } from './workbenchStore'

export type { TopologyId } from './workbenchStore'
export type ActiveVizTab = 'waveforms' | 'bode' | 'losses' | 'thermal'

export interface DesignStoreState {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult | null
  waveforms: WaveformSet | null
  activeVizTab: ActiveVizTab
  isComputing: boolean

  setTopology: (topology: TopologyId) => void
  updateSpec: (updates: Partial<DesignSpec>) => void
  setResult: (result: DesignResult | null, waveforms: WaveformSet | null) => void
  setActiveVizTab: (tab: ActiveVizTab) => void
}

const defaultSpec: DesignSpec = {
  vinMin: 10,
  vinMax: 15,
  vout: 5,
  iout: 2,
  fsw: 500_000,
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.01,
  efficiency: 0.9,
}

export const useDesignStore = create<DesignStoreState>((set) => ({
  topology: 'buck',
  spec: defaultSpec,
  result: null,
  waveforms: null,
  activeVizTab: 'waveforms',
  isComputing: false,

  setTopology: (topology) =>
    set({ topology, result: null, waveforms: null, isComputing: true }),

  updateSpec: (updates) =>
    set((state) => ({
      spec: { ...state.spec, ...updates },
      result: null,
      waveforms: null,
      isComputing: true,
    })),

  setResult: (result, waveforms) =>
    set({ result, waveforms, isComputing: false }),

  setActiveVizTab: (activeVizTab) => set({ activeVizTab }),
}))
