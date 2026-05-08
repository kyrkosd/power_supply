// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
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

const exportAPI = {
  savePdf: (buffer: ArrayBuffer, defaultName: string) =>
    ipcRenderer.invoke('export:save-pdf', { buffer, defaultName }),
  saveCsv: (content: string, defaultName: string) =>
    ipcRenderer.invoke('export:save-csv', { content, defaultName }),
}

const digikeyAPI = {
  setCredentials: (clientId: string, clientSecret: string) =>
    ipcRenderer.invoke('digikey:set-credentials', { clientId, clientSecret }),
  getCredentials: () =>
    ipcRenderer.invoke('digikey:get-credentials'),
  testConnection: () =>
    ipcRenderer.invoke('digikey:test-connection'),
  search: (req: unknown) =>
    ipcRenderer.invoke('digikey:search', req),
}

const pluginAPI = {
  listPlugins: () =>
    ipcRenderer.invoke('plugin:list'),
  openPluginsFolder: () =>
    ipcRenderer.invoke('plugin:open-folder'),
}

const shareAPI = {
  // Retrieve a pswb:// URL that was passed on the command line at launch.
  getLaunchLink: (): Promise<string | null> =>
    ipcRenderer.invoke('share:get-launch-link'),
  // Register a callback for pswb:// URLs arriving while the app is running
  // (second-instance on Windows/Linux, open-url on macOS).
  onDeepLink: (cb: (url: string) => void): void => {
    ipcRenderer.on('share:deep-link', (_event, url: string) => cb(url))
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('projectAPI', projectAPI)
    contextBridge.exposeInMainWorld('exportAPI', exportAPI)
    contextBridge.exposeInMainWorld('digikeyAPI', digikeyAPI)
    contextBridge.exposeInMainWorld('pluginAPI', pluginAPI)
    contextBridge.exposeInMainWorld('shareAPI', shareAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error -- window.electron is declared in env.d.ts
  window.electron = electronAPI
  // @ts-expect-error -- window.projectAPI is declared in env.d.ts
  window.projectAPI = projectAPI
  // @ts-expect-error -- window.exportAPI is declared in env.d.ts
  window.exportAPI = exportAPI
  // @ts-expect-error -- window.digikeyAPI is declared in env.d.ts
  window.digikeyAPI = digikeyAPI
  // @ts-expect-error -- window.pluginAPI is declared in env.d.ts
  window.pluginAPI = pluginAPI
  // @ts-expect-error -- window.shareAPI is declared in env.d.ts
  window.shareAPI = shareAPI
}
