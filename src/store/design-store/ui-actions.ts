// Action factory for modal/panel toggles, plugins, component selection, and option setters.

import { COMPUTE_RESET } from './initial'
import type { UIActions, StoreSet, StoreGet } from './types'

export function createUIActions(set: StoreSet, get: StoreGet): UIActions {
  return {
    saveToComparison: () => {
      const { topology, spec, result } = get()
      if (result) set({ comparisonSlot: { topology, spec, result } })
    },
    setIsComparing:        (open) => set({ isComparing: open }),
    clearComparison:       ()      => set({ comparisonSlot: null, isComparing: false }),

    setIsSequencing:       (open) => set({ isSequencing: open }),
    setIsSettingsOpen:     (open) => set({ isSettingsOpen: open }),
    setIsLibraryOpen:      (open) => set({ isLibraryOpen: open }),
    setIsShareOpen:        (open) => set({ isShareOpen: open }),
    setPendingShareDesign: (d)    => set({ pendingShareDesign: d }),

    setPluginTopology:  (id)      => set({ pluginTopologyId: id, ...COMPUTE_RESET }),
    setPlugins:         (plugins) => set({ plugins }),
    togglePlugin:       (id) => set((state) => ({
      disabledPluginIds: state.disabledPluginIds.includes(id)
        ? state.disabledPluginIds.filter(x => x !== id)
        : [...state.disabledPluginIds, id],
    })),
    requestPluginReload: () => set((state) => ({ pluginReloadRequest: state.pluginReloadRequest + 1 })),

    setIsSweepOpen: (open) => set({ isSweepOpen: open }),

    setSelectedComponent: (key, value) => set((state) => ({
      selectedComponents: { ...state.selectedComponents, [key]: value },
    })),

    setFeedbackOptions:  (opts) => set((state) => ({
      feedbackOptions: { ...state.feedbackOptions, ...opts },
    })),
    setSoftStartOptions: (opts) => set((state) => ({
      softStartOptions: { ...state.softStartOptions, ...opts },
    })),
  }
}
