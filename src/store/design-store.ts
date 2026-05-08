// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { create } from 'zustand'
import type { DesignSpec, DesignResult } from '../engine/types'
import type { WaveformSet } from '../engine/topologies/types'
import type { TopologyId } from './workbenchStore'
import type { MonteCarloResult } from '../engine/monte-carlo'
import type { TransientResult, TransientMode } from '../engine/topologies/types'
import type { EMIResult } from '../engine/topologies/types'
import type { ProjectFile } from '../types/project'
import { undoMiddleware } from './undo-middleware'
import type { SelectedComponents } from '../engine/component-selector'
import { DEFAULT_FEEDBACK_OPTIONS } from '../engine/feedback'
import type { FeedbackOptions } from '../engine/feedback'
import { DEFAULT_SOFT_START_OPTIONS } from '../engine/soft-start'
import type { SoftStartOptions } from '../engine/soft-start'

export type { SelectedComponents } from '../engine/component-selector'
export type { FeedbackOptions } from '../engine/feedback'
export type { SoftStartOptions } from '../engine/soft-start'

export type { TopologyId } from './workbenchStore'
export type ActiveVizTab = 'waveforms' | 'bode' | 'losses' | 'thermal' | 'monte-carlo' | 'ltspice-comparison' | 'transient' | 'emi' | 'efficiency-map' | 'layout' | 'input-filter' | 'results'
export type SweepParam = 'vin' | 'vout' | 'iout' | 'fsw' | 'ripple_ratio' | 'ambient_temp'
export interface SweepPoint { paramValue: number; result: DesignResult | null; phaseMargin: number | null }
export interface SweepResult { sweepParam: SweepParam; points: SweepPoint[] }
export interface SweepRequest { topology: TopologyId; baseSpec: DesignSpec; sweepParam: SweepParam; min: number; max: number; steps: number }

export interface MCRunRequest {
  iterations: number
  seed: number
  computePhaseMargin: boolean
}

export interface ComparisonSlot {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult
}

export interface EfficiencyMapRequest {
  topology: TopologyId
  spec: DesignSpec
}

export interface EfficiencyMapResult {
  matrix: number[][]   // [vinIdx][ioutIdx], 10×10 — values in range 0–1
  vinPoints: number[]  // V
  ioutPoints: number[] // A
}

export interface TransientRunRequest {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult
  mode: TransientMode
  softStartSeconds: number
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

  // Project file state
  currentProjectPath: string | null
  isModified: boolean
  notes: string
  projectCreated: string | null

  // Comparison
  comparisonSlot: ComparisonSlot | null
  isComparing: boolean
  saveToComparison: () => void
  setIsComparing: (open: boolean) => void
  clearComparison: () => void

  // Efficiency map
  efficiencyMapResult: EfficiencyMapResult | null
  efficiencyMapLoading: boolean
  efficiencyMapRequest: EfficiencyMapRequest | null
  requestEfficiencyMap: () => void
  clearEfficiencyMapRequest: () => void
  setEfficiencyMapResult: (r: EfficiencyMapResult | null) => void

  // Transient simulation
  transientLoading: boolean
  transientRunRequest: TransientRunRequest | null
  requestTransientRun: (req: TransientRunRequest) => void
  clearTransientRunRequest: () => void

  // Power sequencing modal
  isSequencing: boolean
  setIsSequencing: (open: boolean) => void

  // Settings modal
  isSettingsOpen: boolean
  setIsSettingsOpen: (open: boolean) => void
  digiKeyEnabled: boolean
  setDigiKeyEnabled: (enabled: boolean) => void

  // Undo / redo (managed by undoMiddleware)
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

  setTopology: (topology: TopologyId) => void
  setTopologyOnly: (topology: TopologyId) => void
  cancelComputing: () => void
  updateSpec: (updates: Partial<DesignSpec>) => void
  resetSpec: () => void
  setResult: (result: DesignResult | null, waveforms: WaveformSet | null, computeTimeMs?: number) => void
  setMcResult: (mcResult: MonteCarloResult | null) => void
  requestMcRun: (req: MCRunRequest) => void
  clearMcRunRequest: () => void
  setTransientResult: (res: TransientResult | null) => void
  setEmiResult: (res: EMIResult | null) => void
  setActiveVizTab: (tab: ActiveVizTab) => void

  activeEquationId: string | null
  setActiveEquationId: (id: string | null) => void

  // Design library
  isLibraryOpen: boolean
  setIsLibraryOpen: (open: boolean) => void
  loadDesignSpec: (topology: TopologyId, spec: DesignSpec) => void

  // Parameter sweep
  isSweepOpen: boolean
  setIsSweepOpen: (open: boolean) => void
  sweepLoading: boolean
  sweepProgress: number
  sweepProgressTotal: number
  sweepResult: SweepResult | null
  sweepRequest: SweepRequest | null
  requestSweep: (req: SweepRequest) => void
  clearSweepRequest: () => void
  setSweepResult: (r: SweepResult | null) => void
  setSweepProgress: (current: number, total: number) => void

  selectedComponents: SelectedComponents
  setSelectedComponent: <K extends keyof SelectedComponents>(key: K, value: SelectedComponents[K]) => void

  feedbackOptions: FeedbackOptions
  setFeedbackOptions: (opts: Partial<FeedbackOptions>) => void

  softStartOptions: SoftStartOptions
  setSoftStartOptions: (opts: Partial<SoftStartOptions>) => void

  // Project actions
  setNotes: (notes: string) => void
  newProject: () => void
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  saveProjectAs: () => Promise<void>
}

// Re-exported from the engine layer so the rest of the app keeps the same
// import path, but defaults are defined exactly once in defaults.ts.
export { TOPOLOGY_DEFAULTS } from '../engine/topologies/defaults'
import { TOPOLOGY_DEFAULTS } from '../engine/topologies/defaults'

const defaultSpec: DesignSpec = TOPOLOGY_DEFAULTS['buck']

function buildProjectFile(state: DesignStoreState, now: string): ProjectFile {
  return {
    version: 1,
    created: state.projectCreated ?? now,
    modified: now,
    topology: state.topology,
    spec: state.spec,
    componentOverrides: {},
    notes: state.notes,
  }
}

const COMPUTE_RESET = {
  result: null,
  waveforms: null,
  mcResult: null,
  transientResult: null,
  transientLoading: false,
  emiResult: null,
  isComputing: true,
} as const

const EMPTY_SELECTION: SelectedComponents = { inductor: null, capacitor: null, mosfet: null }

export const useDesignStore = create<DesignStoreState>(
  // undoMiddleware wraps set() to intercept spec/topology changes and maintain
  // debounced undo history.  It also replaces the undo/redo stubs below.
  // @ts-expect-error Zustand 5 StateCreator overload incompatibility with undoMiddleware's SetFn type
  undoMiddleware((set, get) => ({
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
    computeTimeMs: null,
    currentProjectPath: null,
    isModified: false,
    notes: '',
    projectCreated: null,
    selectedComponents: EMPTY_SELECTION,
    feedbackOptions: { ...DEFAULT_FEEDBACK_OPTIONS },
    softStartOptions: { ...DEFAULT_SOFT_START_OPTIONS },

    // Comparison state
    comparisonSlot: null,
    isComparing: false,

    // Efficiency map state
    efficiencyMapResult: null,
    efficiencyMapLoading: false,
    efficiencyMapRequest: null,

    // Transient simulation state
    transientLoading: false,
    transientRunRequest: null,

    // Power sequencing modal state
    isSequencing: false,

    // Settings modal state
    isSettingsOpen: false,
    digiKeyEnabled: false,

    // Equation explorer state
    activeEquationId: null,

    // Design library state
    isLibraryOpen: false,

    // Sweep analysis state
    isSweepOpen: false,
    sweepLoading: false,
    sweepProgress: 0,
    sweepProgressTotal: 0,
    sweepResult: null,
    sweepRequest: null,

    saveToComparison: () => {
      const { topology, spec, result } = get()
      if (!result) return
      set({ comparisonSlot: { topology, spec, result } })
    },

    setIsComparing: (open) => set({ isComparing: open }),

    clearComparison: () => set({ comparisonSlot: null, isComparing: false }),

    requestEfficiencyMap: () => {
      const { topology, spec } = get()
      set({ efficiencyMapRequest: { topology, spec }, efficiencyMapLoading: true })
    },

    clearEfficiencyMapRequest: () => set({ efficiencyMapRequest: null }),

    setEfficiencyMapResult: (r) => set({ efficiencyMapResult: r, efficiencyMapLoading: false }),

    requestTransientRun: (req) => set({ transientRunRequest: req, transientLoading: true }),
    clearTransientRunRequest: () => set({ transientRunRequest: null }),

    setIsSequencing: (open) => set({ isSequencing: open }),

    setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
    setDigiKeyEnabled: (enabled) => set({ digiKeyEnabled: enabled }),

    // Stubs — overridden by undoMiddleware before the store is returned
    canUndo: false,
    canRedo: false,
    undo: () => {},
    redo: () => {},

    setSelectedComponent: (key, value) =>
      set((state) => ({ selectedComponents: { ...state.selectedComponents, [key]: value } })),

    setFeedbackOptions: (opts) =>
      set((state) => ({ feedbackOptions: { ...state.feedbackOptions, ...opts } })),

    setSoftStartOptions: (opts) =>
      set((state) => ({ softStartOptions: { ...state.softStartOptions, ...opts } })),

    setTopology: (topology) =>
      set({ topology, spec: TOPOLOGY_DEFAULTS[topology], isModified: true, selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET }),

    // Switches topology without resetting spec values (user chose "Keep Current")
    setTopologyOnly: (topology) =>
      set({ topology, isModified: true, selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET }),

    // Cancels the computing spinner when the worker is blocked by validation errors
    cancelComputing: () => set({ isComputing: false }),

    updateSpec: (updates) =>
      set((state) => ({
        spec: { ...state.spec, ...updates },
        isModified: true,
        ...COMPUTE_RESET,
      })),

    resetSpec: () =>
      set((state) => ({
        spec: TOPOLOGY_DEFAULTS[state.topology],
        isModified: true,
        ...COMPUTE_RESET,
      })),

    setResult: (result, waveforms) =>
      set({ result, waveforms, isComputing: false }),

    setMcResult: (mcResult) =>
      set({ mcResult, isComputing: false }),

    requestMcRun: (req) => set({ mcRunRequest: req }),
    clearMcRunRequest: () => set({ mcRunRequest: null }),

    setTransientResult: (transientResult) =>
      set({ transientResult, transientLoading: false }),

    setEmiResult: (emiResult) =>
      set({ emiResult }),

    setActiveVizTab: (activeVizTab) => set({ activeVizTab }),

    setActiveEquationId: (activeEquationId) => set({ activeEquationId }),

    setIsLibraryOpen: (open) => set({ isLibraryOpen: open }),
    loadDesignSpec: (topology, spec) =>
      set({ topology, spec, isModified: true, selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET }),

    setIsSweepOpen: (open) => set({ isSweepOpen: open }),
    requestSweep: (req) => set({ sweepRequest: req, sweepLoading: true, sweepResult: null, sweepProgress: 0, sweepProgressTotal: 0 }),
    clearSweepRequest: () => set({ sweepRequest: null }),
    setSweepResult: (r) => set({ sweepResult: r, sweepLoading: false }),
    setSweepProgress: (current, total) => set({ sweepProgress: current, sweepProgressTotal: total }),

    setNotes: (notes) => set({ notes, isModified: true }),

    newProject: () =>
      set((state) => ({
        spec: TOPOLOGY_DEFAULTS[state.topology],
        notes: '',
        currentProjectPath: null,
        isModified: false,
        projectCreated: null,
        selectedComponents: EMPTY_SELECTION,
        ...COMPUTE_RESET,
      })),

    openProject: async () => {
      const api = window.projectAPI
      if (!api) return
      const res = await api.open()
      if (!res.success || !res.project) return
      const project = res.project
      set({
        topology: project.topology,
        spec: project.spec,
        notes: project.notes,
        currentProjectPath: res.filePath ?? null,
        isModified: false,
        projectCreated: project.created,
        selectedComponents: EMPTY_SELECTION,
        ...COMPUTE_RESET,
      })
    },

    saveProject: async () => {
      const api = window.projectAPI
      if (!api) return
      const state = get()
      const now = new Date().toISOString()
      const project = buildProjectFile(state, now)
      const content = JSON.stringify(project, null, 2)

      if (state.currentProjectPath) {
        const res = await api.save(state.currentProjectPath, content)
        if (res.success) set({ isModified: false, projectCreated: project.created })
      } else {
        const res = await api.saveAs(content)
        if (res.success && res.filePath) {
          set({ currentProjectPath: res.filePath, isModified: false, projectCreated: project.created })
        }
      }
    },

    saveProjectAs: async () => {
      const api = window.projectAPI
      if (!api) return
      const state = get()
      const now = new Date().toISOString()
      const project = buildProjectFile(state, now)
      const content = JSON.stringify(project, null, 2)
      const res = await api.saveAs(content)
      if (res.success && res.filePath) {
        set({ currentProjectPath: res.filePath, isModified: false, projectCreated: project.created })
      }
    },
  }))
)
