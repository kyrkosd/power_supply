// Central Zustand store for the application.
//
// Wrapped with undoMiddleware so every spec/topology change is automatically recorded
// with a 300 ms debounce, enabling Ctrl+Z / Ctrl+Shift+Z undo–redo.
// Heavy computation lives in App.tsx (worker dispatch) — this file owns state only.
//
// Domain slices live in design-store/:
//   types.ts             — state + action interfaces, public-API types
//   initial.ts           — initial-state constants
//   compute-actions.ts   — topology / spec / result / viz tab
//   analysis-actions.ts  — MC, transient, EMI, sweep, efficiency map
//   project-actions.ts   — project file lifecycle (via project-io.ts)
//   ui-actions.ts        — modals, plugins, component selection, options

import { create } from 'zustand'
import { undoMiddleware } from './undo-middleware'
import { DEFAULT_FEEDBACK_OPTIONS } from '../engine/feedback'
import { DEFAULT_SOFT_START_OPTIONS } from '../engine/soft-start'
import { TOPOLOGY_DEFAULTS } from '../engine/topologies/defaults'

import {
  EMPTY_SELECTION, INITIAL_COMPUTE, INITIAL_ANALYSIS, INITIAL_PROJECT, INITIAL_UI,
} from './design-store/initial'
import { createComputeActions }  from './design-store/compute-actions'
import { createAnalysisActions } from './design-store/analysis-actions'
import { createProjectActions }  from './design-store/project-actions'
import { createUIActions }       from './design-store/ui-actions'
import type { DesignStoreState, StoreSet, StoreGet } from './design-store/types'

// Re-exported types so existing import sites keep working.
export type {
  ActiveVizTab, SweepParam, SweepPoint, SweepResult, SweepRequest,
  MCRunRequest, ComparisonSlot, EfficiencyMapRequest, EfficiencyMapResult,
  TransientRunRequest, DesignStoreState,
} from './design-store/types'
export type { SelectedComponents } from '../engine/component-selector'
export type { FeedbackOptions }    from '../engine/feedback'
export type { SoftStartOptions }   from '../engine/soft-start'
export type { TopologyId }         from './workbenchStore'
export { TOPOLOGY_DEFAULTS }       from '../engine/topologies/defaults'

export const useDesignStore = create<DesignStoreState>(
  // @ts-expect-error Zustand 5 StateCreator overload incompatibility with undoMiddleware's SetFn type
  undoMiddleware((set, get) => {
    const setX = set as StoreSet
    const getX = get as StoreGet
    void TOPOLOGY_DEFAULTS  // anchor the import for downstream IDE navigation
    return {
      ...INITIAL_COMPUTE,
      ...INITIAL_ANALYSIS,
      ...INITIAL_PROJECT,
      ...INITIAL_UI,
      selectedComponents: EMPTY_SELECTION,
      feedbackOptions:    { ...DEFAULT_FEEDBACK_OPTIONS },
      softStartOptions:   { ...DEFAULT_SOFT_START_OPTIONS },
      ...createComputeActions(setX),
      ...createAnalysisActions(setX, getX),
      ...createProjectActions(setX, getX),
      ...createUIActions(setX, getX),
    }
  }),
)
