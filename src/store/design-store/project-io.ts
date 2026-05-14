// Project file load/save helpers — wraps window.projectAPI calls.

import type { ProjectFile } from '../../types/project'
import { COMPUTE_RESET, EMPTY_SELECTION } from './initial'
import type { DesignStoreState, StoreSet } from './types'

function buildProjectFile(state: DesignStoreState, now: string): ProjectFile {
  return {
    version:           1,
    created:           state.projectCreated ?? now,
    modified:          now,
    topology:          state.topology,
    spec:              state.spec,
    componentOverrides: {},
    notes:             state.notes,
  }
}

function serializeDesign(state: DesignStoreState): { project: ProjectFile; content: string } {
  const now     = new Date().toISOString()
  const project = buildProjectFile(state, now)
  return { project, content: JSON.stringify(project, null, 2) }
}

function applySaved(project: ProjectFile, set: StoreSet): void {
  set({ isModified: false, projectCreated: project.created })
}

function applySavedAs(filePath: string, project: ProjectFile, set: StoreSet): void {
  set({ currentProjectPath: filePath, isModified: false, projectCreated: project.created })
}

export async function performOpenProject(set: StoreSet): Promise<void> {
  const api = window.projectAPI
  if (!api) return
  const res = await api.open()
  if (!res.success || !res.project) return
  const { project } = res
  set({
    topology:           project.topology,
    spec:               project.spec,
    notes:              project.notes,
    currentProjectPath: res.filePath ?? null,
    isModified:         false,
    projectCreated:     project.created,
    selectedComponents: EMPTY_SELECTION,
    ...COMPUTE_RESET,
  })
}

export async function performSaveProject(state: DesignStoreState, set: StoreSet): Promise<void> {
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

export async function performSaveProjectAs(state: DesignStoreState, set: StoreSet): Promise<void> {
  const api = window.projectAPI
  if (!api) return
  const { project, content } = serializeDesign(state)
  const res = await api.saveAs(content)
  if (res.success && res.filePath) applySavedAs(res.filePath, project, set)
}
