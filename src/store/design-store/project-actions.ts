// Action factory for project file operations + spec loading.

import { TOPOLOGY_DEFAULTS } from '../../engine/topologies/defaults'
import { COMPUTE_RESET, EMPTY_SELECTION } from './initial'
import { performOpenProject, performSaveProject, performSaveProjectAs } from './project-io'
import type { ProjectActions, StoreSet, StoreGet } from './types'

export function createProjectActions(set: StoreSet, get: StoreGet): ProjectActions {
  return {
    setNotes: (notes) => set({ notes, isModified: true }),

    newProject: () => set((state) => ({
      spec: TOPOLOGY_DEFAULTS[state.topology],
      notes: '',
      currentProjectPath: null,
      isModified:    false,
      projectCreated: null,
      selectedComponents: EMPTY_SELECTION,
      ...COMPUTE_RESET,
    })),

    openProject:    () => performOpenProject(set),
    saveProject:    () => performSaveProject(get(), set),
    saveProjectAs:  () => performSaveProjectAs(get(), set),

    loadDesignSpec: (topology, spec) => set({
      topology, spec, pluginTopologyId: null, isModified: true,
      selectedComponents: EMPTY_SELECTION, ...COMPUTE_RESET,
    }),
  }
}
