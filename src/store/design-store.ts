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
import type { PluginMeta } from '../engine/plugin-types'
import type { ShareableDesign } from '../export/share-link'
import { DEFAULT_FEEDBACK_OPTIONS } from '../engine/feedback'
import type { FeedbackOptions } from '../engine/feedback'
import { DEFAULT_SOFT_START_OPTIONS } from '../engine/soft-start'
import type { SoftStartOptions } from '../engine/soft-start'

// Re-export types consumed by the rest of the app so import paths stay stable.
export type { SelectedComponents } from '../engine/component-selector'
export type { FeedbackOptions }    from '../engine/feedback'
export type { SoftStartOptions }   from '../engine/soft-start'
export type { TopologyId }         from './workbenchStore'
export { TOPOLOGY_DEFAULTS }       from '../engine/topologies/defaults'
import { TOPOLOGY_DEFAULTS }       from '../engine/topologies/defaults'

// ── Supporting types ──────────────────────────────────────────────────────────

/** Currently active visualization tab in the center column. */
export type ActiveVizTab =
  | 'waveforms' | 'bode' | 'losses' | 'thermal'
  | 'monte-carlo' | 'ltspice-comparison' | 'transient' | 'emi'
  | 'efficiency-map' | 'layout' | 'input-filter' | 'results'

/** Parameter that drives a parameter sweep run. */
export type SweepParam = 'vin' | 'vout' | 'iout' | 'fsw' | 'ripple_ratio' | 'ambient_temp'

export interface SweepPoint {
  paramValue: number
  result: DesignResult | null
  phaseMargin: number | null
}

export interface SweepResult {
  sweepParam: SweepParam
  points: SweepPoint[]
}

export interface SweepRequest {
  topology: TopologyId
  baseSpec: DesignSpec
  sweepParam: SweepParam
  min: number
  max: number
  steps: number
}

export interface MCRunRequest {
  iterations: number
  seed: number
  computePhaseMargin: boolean
}

/** Snapshot saved by the user as "Design A" for side-by-side comparison. */
export interface ComparisonSlot {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult
}

export interface EfficiencyMapRequest {
  topology: TopologyId
  spec: DesignSpec
}

/** 10 × 10 efficiency matrix indexed by [vinIdx][ioutIdx], values in 0–1. */
export interface EfficiencyMapResult {
  matrix: number[][]
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

// ── Domain state interfaces ───────────────────────────────────────────────────

/** Core computation state — topology, spec, result, and the active tab. */
interface ComputeState {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult | null
  waveforms: WaveformSet | null
  isComputing: boolean
  computeTimeMs: number | null
  activeVizTab: ActiveVizTab
}

/** Analysis simulation state — MC, transient, EMI, efficiency map. */
interface AnalysisState {
  mcResult: MonteCarloResult | null
  mcRunRequest: MCRunRequest | null
  transientResult: TransientResult | null
  transientLoading: boolean
  transientRunRequest: TransientRunRequest | null
  emiResult: EMIResult | null
  efficiencyMapResult: EfficiencyMapResult | null
  efficiencyMapLoading: boolean
  efficiencyMapRequest: EfficiencyMapRequest | null
}

/** Persistent project file state — path, dirty flag, notes, timestamps. */
interface ProjectFileState {
  currentProjectPath: string | null
  isModified: boolean
  notes: string
  projectCreated: string | null
}

/** UI overlay and tool state — modals, panels, component selections. */
interface UIState {
  comparisonSlot: ComparisonSlot | null
  isComparing: boolean
  isSequencing: boolean
  isSettingsOpen: boolean
  digiKeyEnabled: boolean
  activeEquationId: string | null
  isLibraryOpen: boolean
  isShareOpen: boolean
  pendingShareDesign: ShareableDesign | null
  pluginTopologyId: string | null
  plugins: PluginMeta[]
  disabledPluginIds: string[]
  pluginReloadRequest: number
  isSweepOpen: boolean
  sweepLoading: boolean
  sweepProgress: number
  sweepProgressTotal: number
  sweepResult: SweepResult | null
  sweepRequest: SweepRequest | null
  selectedComponents: SelectedComponents
  feedbackOptions: FeedbackOptions
  softStartOptions: SoftStartOptions
}

// ── Action interfaces ─────────────────────────────────────────────────────────

interface ComputeActions {
  setTopology: (topology: TopologyId) => void
  setTopologyOnly: (topology: TopologyId) => void
  cancelComputing: () => void
  updateSpec: (updates: Partial<DesignSpec>) => void
  resetSpec: () => void
  setResult: (result: DesignResult | null, waveforms: WaveformSet | null, computeTimeMs?: number) => void
  setActiveVizTab: (tab: ActiveVizTab) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

interface AnalysisActions {
  setMcResult: (mcResult: MonteCarloResult | null) => void
  requestMcRun: (req: MCRunRequest) => void
  clearMcRunRequest: () => void
  setTransientResult: (res: TransientResult | null) => void
  clearTransientRunRequest: () => void
  requestTransientRun: (req: TransientRunRequest) => void
  setEmiResult: (res: EMIResult | null) => void
  requestEfficiencyMap: () => void
  clearEfficiencyMapRequest: () => void
  setEfficiencyMapResult: (r: EfficiencyMapResult | null) => void
  requestSweep: (req: SweepRequest) => void
  clearSweepRequest: () => void
  setSweepResult: (r: SweepResult | null) => void
  setSweepProgress: (current: number, total: number) => void
  setActiveEquationId: (id: string | null) => void
}

interface ProjectActions {
  setNotes: (notes: string) => void
  newProject: () => void
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  saveProjectAs: () => Promise<void>
  loadDesignSpec: (topology: TopologyId, spec: DesignSpec) => void
}

interface UIActions {
  saveToComparison: () => void
  setIsComparing: (open: boolean) => void
  clearComparison: () => void
  setIsSequencing: (open: boolean) => void
  setIsSettingsOpen: (open: boolean) => void
  setDigiKeyEnabled: (enabled: boolean) => void
  setIsLibraryOpen: (open: boolean) => void
  setIsShareOpen: (open: boolean) => void
  setPendingShareDesign: (d: ShareableDesign | null) => void
  setPluginTopology: (id: string | null) => void
  setPlugins: (plugins: PluginMeta[]) => void
  togglePlugin: (id: string) => void
  requestPluginReload: () => void
  setIsSweepOpen: (open: boolean) => void
  setSelectedComponent: <K extends keyof SelectedComponents>(key: K, value: SelectedComponents[K]) => void
  setFeedbackOptions: (opts: Partial<FeedbackOptions>) => void
  setSoftStartOptions: (opts: Partial<SoftStartOptions>) => void
}

/** Full store shape — the intersection of all domain state and action interfaces. */
export interface DesignStoreState
  extends ComputeState, AnalysisState, ProjectFileState, UIState,
          ComputeActions, AnalysisActions, ProjectActions, UIActions {}

// ── Shared constants ──────────────────────────────────────────────────────────

const defaultSpec: DesignSpec = TOPOLOGY_DEFAULTS['buck']

/** Applied on every topology/spec change to clear stale computed outputs. */
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

// ── Initial state slices ──────────────────────────────────────────────────────

const INITIAL_COMPUTE: Partial<ComputeState> = {
  topology: 'buck',
  spec: defaultSpec,
  result: null,
  waveforms: null,
  isComputing: false,
  computeTimeMs: null,
  activeVizTab: 'waveforms',
}

const INITIAL_ANALYSIS: Partial<AnalysisState> = {
  mcResult: null,
  mcRunRequest: null,
  transientResult: null,
  transientLoading: false,
  transientRunRequest: null,
  emiResult: null,
  efficiencyMapResult: null,
  efficiencyMapLoading: false,
  efficiencyMapRequest: null,
}

const INITIAL_PROJECT: Partial<ProjectFileState> = {
  currentProjectPath: null,
  isModified: false,
  notes: '',
  projectCreated: null,
}

const INITIAL_UI: Partial<UIState> = {
  comparisonSlot: null,
  isComparing: false,
  isSequencing: false,
  isSettingsOpen: false,
  digiKeyEnabled: false,
  activeEquationId: null,
  isLibraryOpen: false,
  isShareOpen: false,
  pendingShareDesign: null,
  pluginTopologyId: null,
  plugins: [],
  disabledPluginIds: [],
  pluginReloadRequest: 0,
  isSweepOpen: false,
  sweepLoading: false,
  sweepProgress: 0,
  sweepProgressTotal: 0,
  sweepResult: null,
  sweepRequest: null,
}

// ── Project action helpers ────────────────────────────────────────────────────

/** Builds the serialisable project file from live store state. */
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

type StoreSetter = (partial: Partial<DesignStoreState>) => void

/** Serialises the current design to a JSON string and its ProjectFile record. */
function serializeDesign(state: DesignStoreState): { project: ProjectFile; content: string } {
  const now = new Date().toISOString()
  const project = buildProjectFile(state, now)
  return { project, content: JSON.stringify(project, null, 2) }
}

/** Commits the result of a successful overwrite-save to the store. */
function applySaved(project: ProjectFile, set: StoreSetter): void {
  set({ isModified: false, projectCreated: project.created })
}

/** Commits the result of a successful Save As to the store. */
function applySavedAs(filePath: string, project: ProjectFile, set: StoreSetter): void {
  set({ currentProjectPath: filePath, isModified: false, projectCreated: project.created })
}

async function performOpenProject(set: StoreSetter): Promise<void> {
  const api = window.projectAPI
  if (!api) return
  const res = await api.open()
  if (!res.success || !res.project) return
  const { project } = res
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
}

async function performSaveProject(state: DesignStoreState, set: StoreSetter): Promise<void> {
  const api = window.projectAPI
  if (!api) return
  const { project, content } = serializeDesign(state)
  if (state.currentProjectPath) {
    const res = await api.save(state.currentProjectPath, content)
    if (res.success) applySaved(project, set)
  } else {
    const res = await api.saveAs(content)
    if (res.success && res.filePath) applySavedAs(res.filePath, project, set)
  }
}

async function performSaveProjectAs(state: DesignStoreState, set: StoreSetter): Promise<void> {
  const api = window.projectAPI
  if (!api) return
  const { project, content } = serializeDesign(state)
  const res = await api.saveAs(content)
  if (res.success && res.filePath) applySavedAs(res.filePath, project, set)
}

// ── Store ─────────────────────────────────────────────────────────────────────

/**
 * Central application store.
 *
 * Wrapped with `undoMiddleware` so every spec/topology change is automatically
 * recorded with a 300 ms debounce, enabling Ctrl+Z / Ctrl+Shift+Z undo–redo.
 * Heavy computation is intentionally absent — see `App.tsx` for worker dispatch.
 */
export const useDesignStore = create<DesignStoreState>(
  // @ts-expect-error Zustand 5 StateCreator overload incompatibility with undoMiddleware's SetFn type
  undoMiddleware((set, get) => ({
    ...INITIAL_COMPUTE,
    ...INITIAL_ANALYSIS,
    ...INITIAL_PROJECT,
    ...INITIAL_UI,
    selectedComponents: EMPTY_SELECTION,
    feedbackOptions: { ...DEFAULT_FEEDBACK_OPTIONS },
    softStartOptions: { ...DEFAULT_SOFT_START_OPTIONS },

    // Stubs replaced by undoMiddleware before the store is returned
    canUndo: false,
    canRedo: false,
    undo: () => {},
    redo: () => {},

    // ── Compute actions ───────────────────────────────────────────────────────

    /** Switches topology and resets spec to canonical defaults. */
    setTopology: (topology) =>
      set({ topology, spec: TOPOLOGY_DEFAULTS[topology], pluginTopologyId: null, isModified: true, selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET }),

    /** Switches topology while keeping the current spec values (user chose "Keep Current"). */
    setTopologyOnly: (topology) =>
      set({ topology, pluginTopologyId: null, isModified: true, selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET }),

    /** Clears the computing spinner when the worker is blocked by validation errors. */
    cancelComputing: () => set({ isComputing: false }),

    updateSpec: (updates) =>
      set((state) => ({ spec: { ...state.spec, ...updates }, isModified: true, ...COMPUTE_RESET })),

    resetSpec: () =>
      set((state) => ({ spec: TOPOLOGY_DEFAULTS[state.topology], isModified: true, ...COMPUTE_RESET })),

    setResult: (result, waveforms) =>
      set({ result, waveforms, isComputing: false }),

    setActiveVizTab: (activeVizTab) => set({ activeVizTab }),

    // ── Analysis actions ──────────────────────────────────────────────────────

    setMcResult: (mcResult) => set({ mcResult, isComputing: false }),
    requestMcRun: (req) => set({ mcRunRequest: req }),
    clearMcRunRequest: () => set({ mcRunRequest: null }),

    setTransientResult: (transientResult) => set({ transientResult, transientLoading: false }),
    requestTransientRun: (req) => set({ transientRunRequest: req, transientLoading: true }),
    clearTransientRunRequest: () => set({ transientRunRequest: null }),

    setEmiResult: (emiResult) => set({ emiResult }),

    requestEfficiencyMap: () => {
      const { topology, spec } = get()
      set({ efficiencyMapRequest: { topology, spec }, efficiencyMapLoading: true })
    },
    clearEfficiencyMapRequest: () => set({ efficiencyMapRequest: null }),
    setEfficiencyMapResult: (r) => set({ efficiencyMapResult: r, efficiencyMapLoading: false }),

    requestSweep: (req) =>
      set({ sweepRequest: req, sweepLoading: true, sweepResult: null, sweepProgress: 0, sweepProgressTotal: 0 }),
    clearSweepRequest: () => set({ sweepRequest: null }),
    setSweepResult: (r) => set({ sweepResult: r, sweepLoading: false }),
    setSweepProgress: (current, total) => set({ sweepProgress: current, sweepProgressTotal: total }),

    setActiveEquationId: (activeEquationId) => set({ activeEquationId }),

    // ── Project actions ───────────────────────────────────────────────────────

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

    openProject:    () => performOpenProject(set as StoreSetter),
    saveProject:    () => performSaveProject(get(), set as StoreSetter),
    saveProjectAs:  () => performSaveProjectAs(get(), set as StoreSetter),

    loadDesignSpec: (topology, spec) =>
      set({ topology, spec, pluginTopologyId: null, isModified: true, selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET }),

    // ── UI actions ────────────────────────────────────────────────────────────

    saveToComparison: () => {
      const { topology, spec, result } = get()
      if (result) set({ comparisonSlot: { topology, spec, result } })
    },
    setIsComparing: (open) => set({ isComparing: open }),
    clearComparison: () => set({ comparisonSlot: null, isComparing: false }),

    setIsSequencing: (open) => set({ isSequencing: open }),
    setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
    setDigiKeyEnabled: (enabled) => set({ digiKeyEnabled: enabled }),
    setIsLibraryOpen: (open) => set({ isLibraryOpen: open }),
    setIsShareOpen: (open) => set({ isShareOpen: open }),
    setPendingShareDesign: (d) => set({ pendingShareDesign: d }),

    setPluginTopology: (id) => set({ pluginTopologyId: id, ...COMPUTE_RESET }),
    setPlugins: (plugins) => set({ plugins }),
    togglePlugin: (id) =>
      set((state) => ({
        disabledPluginIds: state.disabledPluginIds.includes(id)
          ? state.disabledPluginIds.filter(x => x !== id)
          : [...state.disabledPluginIds, id],
      })),
    requestPluginReload: () =>
      set((state) => ({ pluginReloadRequest: state.pluginReloadRequest + 1 })),

    setIsSweepOpen: (open) => set({ isSweepOpen: open }),

    setSelectedComponent: (key, value) =>
      set((state) => ({ selectedComponents: { ...state.selectedComponents, [key]: value } })),

    setFeedbackOptions: (opts) =>
      set((state) => ({ feedbackOptions: { ...state.feedbackOptions, ...opts } })),

    setSoftStartOptions: (opts) =>
      set((state) => ({ softStartOptions: { ...state.softStartOptions, ...opts } })),
  }))
)
