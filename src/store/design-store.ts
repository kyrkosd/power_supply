import { create } from 'zustand'
import type { DesignSpec, DesignResult } from '../engine/types'
import type { WaveformSet } from '../engine/topologies/types'
import type { TopologyId } from './workbenchStore'
import type { MonteCarloResult } from '../engine/monte-carlo'
import type { TransientResult } from '../engine/topologies/types'
import type { EMIResult } from '../engine/topologies/types'
import type { ProjectFile } from '../types/project'
import { undoMiddleware } from './undo-middleware'
import type { SelectedComponents } from '../engine/component-selector'

export type { SelectedComponents } from '../engine/component-selector'

export type { TopologyId } from './workbenchStore'
export type ActiveVizTab = 'waveforms' | 'bode' | 'losses' | 'thermal' | 'monte-carlo' | 'ltspice-comparison' | 'transient' | 'emi'

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

  // Undo / redo (managed by undoMiddleware)
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

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

  selectedComponents: SelectedComponents
  setSelectedComponent: <K extends keyof SelectedComponents>(key: K, value: SelectedComponents[K]) => void

  // Project actions
  setNotes: (notes: string) => void
  newProject: () => void
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  saveProjectAs: () => Promise<void>
}

export const TOPOLOGY_DEFAULTS: Record<TopologyId, DesignSpec> = {
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
  emiResult: null,
  isComputing: true,
} as const

const EMPTY_SELECTION: SelectedComponents = { inductor: null, capacitor: null, mosfet: null }

export const useDesignStore = create<DesignStoreState>(
  // undoMiddleware wraps set() to intercept spec/topology changes and maintain
  // debounced undo history.  It also replaces the undo/redo stubs below.
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

    // Comparison state
    comparisonSlot: null,
    isComparing: false,

    saveToComparison: () => {
      const { topology, spec, result } = get()
      if (!result) return
      set({ comparisonSlot: { topology, spec, result } })
    },

    setIsComparing: (open) => set({ isComparing: open }),

    clearComparison: () => set({ comparisonSlot: null, isComparing: false }),

    // Stubs — overridden by undoMiddleware before the store is returned
    canUndo: false,
    canRedo: false,
    undo: () => {},
    redo: () => {},

    setSelectedComponent: (key, value) =>
      set((state) => ({ selectedComponents: { ...state.selectedComponents, [key]: value } })),

    setTopology: (topology) =>
      set({ topology, spec: TOPOLOGY_DEFAULTS[topology], isModified: true, selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET }),

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
      set({ transientResult }),

    setEmiResult: (emiResult) =>
      set({ emiResult }),

    setActiveVizTab: (activeVizTab) => set({ activeVizTab }),

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
