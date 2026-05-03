import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const projectAPI = {
  save: (filePath: string, content: string) =>
    ipcRenderer.invoke('project:save', { content, filePath }),
  saveAs: (content: string) =>
    ipcRenderer.invoke('project:save-as', content),
  open: () =>
    ipcRenderer.invoke('project:open'),
  recent: () =>
    ipcRenderer.invoke('project:recent'),
  setTitle: (filename: string | null, modified: boolean) =>
    ipcRenderer.invoke('project:set-title', { filename, modified }),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('projectAPI', projectAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error -- window.electron is declared in env.d.ts
  window.electron = electronAPI
  // @ts-expect-error -- window.projectAPI is declared in env.d.ts
  window.projectAPI = projectAPI
}
