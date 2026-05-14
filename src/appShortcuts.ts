import type { ActiveVizTab } from './store/design-store'

export type FileHandlers = { newProject: () => void; openProject: () => void; saveProject: () => void; saveProjectAs: () => void }
export type EditHandlers  = { undo: () => void; redo: () => void; setActiveVizTab: (t: ActiveVizTab) => void; saveToComparison: () => void; setIsComparing: (v: boolean) => void; setIsLibraryOpen: (v: boolean) => void }

const TAB_KEYS: Record<string, ActiveVizTab> = { '1': 'waveforms', '2': 'bode', '3': 'losses', '4': 'thermal' }

export function handleFileShortcut(event: KeyboardEvent, h: FileHandlers): boolean {
  if (!event.ctrlKey && !event.metaKey) return false
  if (event.key === 'n' && !event.shiftKey) { event.preventDefault(); h.newProject();    return true }
  if (event.key === 'o' && !event.shiftKey) { event.preventDefault(); h.openProject();   return true }
  if (event.key === 's') { event.preventDefault(); event.shiftKey ? h.saveProjectAs() : h.saveProject(); return true }
  return false
}

export function handleEditShortcut(event: KeyboardEvent, h: EditHandlers): void {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const tab = TAB_KEYS[event.key]
  if (tab)               { h.setActiveVizTab(tab); return }
  if (event.key === 'z') { event.shiftKey ? h.redo() : h.undo(); return }
  if (event.key === 'y') { h.redo(); return }
  if (event.key === 'k') { event.shiftKey ? h.setIsComparing(true) : h.saveToComparison(); return }
  if (event.key === 'l') { h.setIsLibraryOpen(true) }
}
