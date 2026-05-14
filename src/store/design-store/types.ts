// Public state and action types for the design store, organised by domain slice.

import type { DesignSpec, DesignResult } from '../../engine/types'
import type {
  WaveformSet, TransientResult, TransientMode, EMIResult,
} from '../../engine/topologies/types'
import type { MonteCarloResult } from '../../engine/monte-carlo'
import type { SelectedComponents } from '../../engine/component-selector'
import type { FeedbackOptions } from '../../engine/feedback'
import type { SoftStartOptions } from '../../engine/soft-start'
import type { PluginMeta } from '../../engine/plugin-types'
import type { ShareableDesign } from '../../export/share-link'
import type { TopologyId } from '../workbenchStore'

export type ActiveVizTab =
  | 'waveforms' | 'bode' | 'losses' | 'thermal'
  | 'monte-carlo' | 'ltspice-comparison' | 'transient' | 'emi'
  | 'efficiency-map' | 'layout' | 'input-filter' | 'results'

export type SweepParam = 'vin' | 'vout' | 'iout' | 'fsw' | 'ripple_ratio' | 'ambient_temp'

export interface SweepPoint   { paramValue: number; result: DesignResult | null; phaseMargin: number | null }
export interface SweepResult  { sweepParam: SweepParam; points: SweepPoint[] }
export interface SweepRequest { topology: TopologyId; baseSpec: DesignSpec; sweepParam: SweepParam; min: number; max: number; steps: number }

export interface MCRunRequest { iterations: number; seed: number; computePhaseMargin: boolean }

export interface ComparisonSlot { topology: TopologyId; spec: DesignSpec; result: DesignResult }

export interface EfficiencyMapRequest { topology: TopologyId; spec: DesignSpec }
export interface EfficiencyMapResult  { matrix: number[][]; vinPoints: number[]; ioutPoints: number[] }

export interface TransientRunRequest {
  topology: TopologyId; spec: DesignSpec; result: DesignResult
  mode: TransientMode; softStartSeconds: number
}

// ── Domain state interfaces ───────────────────────────────────────────────────

export interface ComputeState {
  topology: TopologyId
  spec: DesignSpec
  result: DesignResult | null
  waveforms: WaveformSet | null
  isComputing: boolean
  computeTimeMs: number | null
  activeVizTab: ActiveVizTab
}

export interface AnalysisState {
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

export interface ProjectFileState {
  currentProjectPath: string | null
  isModified: boolean
  notes: string
  projectCreated: string | null
}

export interface UIState {
  comparisonSlot: ComparisonSlot | null
  isComparing: boolean
  isSequencing: boolean
  isSettingsOpen: boolean
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

export interface ComputeActions {
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

export interface AnalysisActions {
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

export interface ProjectActions {
  setNotes: (notes: string) => void
  newProject: () => void
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  saveProjectAs: () => Promise<void>
  loadDesignSpec: (topology: TopologyId, spec: DesignSpec) => void
}

export interface UIActions {
  saveToComparison: () => void
  setIsComparing: (open: boolean) => void
  clearComparison: () => void
  setIsSequencing: (open: boolean) => void
  setIsSettingsOpen: (open: boolean) => void
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

export type StoreSet = (partial: Partial<DesignStoreState> | ((s: DesignStoreState) => Partial<DesignStoreState>)) => void
export type StoreGet = () => DesignStoreState
