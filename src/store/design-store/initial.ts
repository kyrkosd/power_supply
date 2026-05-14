// Initial-state constants for each domain slice of the design store.

import type { SelectedComponents } from '../../engine/component-selector'
import { TOPOLOGY_DEFAULTS } from '../../engine/topologies/defaults'
import type {
  ComputeState, AnalysisState, ProjectFileState, UIState,
} from './types'

export const EMPTY_SELECTION: SelectedComponents = { inductor: null, capacitor: null, mosfet: null }

/** Applied on every topology/spec change to clear stale computed outputs. */
export const COMPUTE_RESET = {
  result: null,
  waveforms: null,
  mcResult: null,
  transientResult: null,
  transientLoading: false,
  emiResult: null,
  isComputing: true,
} as const

export const INITIAL_COMPUTE: Partial<ComputeState> = {
  topology: 'buck',
  spec: TOPOLOGY_DEFAULTS['buck'],
  result: null,
  waveforms: null,
  isComputing: false,
  computeTimeMs: null,
  activeVizTab: 'waveforms',
}

export const INITIAL_ANALYSIS: Partial<AnalysisState> = {
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

export const INITIAL_PROJECT: Partial<ProjectFileState> = {
  currentProjectPath: null,
  isModified: false,
  notes: '',
  projectCreated: null,
}

export const INITIAL_UI: Partial<UIState> = {
  comparisonSlot: null,
  isComparing: false,
  isSequencing: false,
  isSettingsOpen: false,
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
