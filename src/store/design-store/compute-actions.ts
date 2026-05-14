// Action factory for the core compute slice (topology, spec, result, viz tab).

import { TOPOLOGY_DEFAULTS } from '../../engine/topologies/defaults'
import { COMPUTE_RESET, EMPTY_SELECTION } from './initial'
import type { ComputeActions, StoreSet } from './types'

export function createComputeActions(set: StoreSet): ComputeActions {
  return {
    setTopology: (topology) => set({
      topology, spec: TOPOLOGY_DEFAULTS[topology], pluginTopologyId: null,
      isModified: true, selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET,
    }),
    setTopologyOnly: (topology) => set({
      topology, pluginTopologyId: null, isModified: true,
      selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET,
    }),
    cancelComputing: () => set({ isComputing: false }),
    updateSpec: (updates) => set((state) => ({
      spec: { ...state.spec, ...updates }, isModified: true, ...COMPUTE_RESET,
    })),
    resetSpec: () => set((state) => ({
      spec: TOPOLOGY_DEFAULTS[state.topology], isModified: true, ...COMPUTE_RESET,
    })),
    setResult: (result, waveforms) => set({ result, waveforms, isComputing: false }),
    setActiveVizTab: (activeVizTab) => set({ activeVizTab }),

    // Stubs replaced by undoMiddleware before the store is returned.
    canUndo: false, canRedo: false,
    undo: () => {}, redo: () => {},
  }
}
