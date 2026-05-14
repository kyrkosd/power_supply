// Action factory for MC, transient, EMI, efficiency-map, sweep, and equation selection.

import type { AnalysisActions, StoreSet, StoreGet } from './types'

export function createAnalysisActions(set: StoreSet, get: StoreGet): AnalysisActions {
  return {
    setMcResult:        (mcResult) => set({ mcResult, isComputing: false }),
    requestMcRun:       (req) => set({ mcRunRequest: req }),
    clearMcRunRequest:  () => set({ mcRunRequest: null }),

    setTransientResult:       (transientResult) => set({ transientResult, transientLoading: false }),
    requestTransientRun:      (req) => set({ transientRunRequest: req, transientLoading: true }),
    clearTransientRunRequest: () => set({ transientRunRequest: null }),

    setEmiResult: (emiResult) => set({ emiResult }),

    requestEfficiencyMap: () => {
      const { topology, spec } = get()
      set({ efficiencyMapRequest: { topology, spec }, efficiencyMapLoading: true })
    },
    clearEfficiencyMapRequest: () => set({ efficiencyMapRequest: null }),
    setEfficiencyMapResult:    (r) => set({ efficiencyMapResult: r, efficiencyMapLoading: false }),

    requestSweep: (req) => set({
      sweepRequest: req, sweepLoading: true,
      sweepResult: null, sweepProgress: 0, sweepProgressTotal: 0,
    }),
    clearSweepRequest:  () => set({ sweepRequest: null }),
    setSweepResult:     (r) => set({ sweepResult: r, sweepLoading: false }),
    setSweepProgress:   (current, total) => set({ sweepProgress: current, sweepProgressTotal: total }),

    setActiveEquationId: (activeEquationId) => set({ activeEquationId }),
  }
}
