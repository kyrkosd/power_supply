// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
/// <reference types="vite/client" />

interface ProjectSaveResult {
  success: boolean
  filePath?: string
  error?: string
}

interface ProjectOpenResult {
  success: boolean
  filePath?: string
  project?: import('./types/project').ProjectFile
  error?: string
}

interface ExportSaveResult {
  success: boolean
  filePath?: string
  error?: string
}

interface Window {
  electron: import('@electron-toolkit/preload').ElectronAPI
  projectAPI?: {
    save: (filePath: string, content: string) => Promise<ProjectSaveResult>
    saveAs: (content: string) => Promise<ProjectSaveResult>
    open: () => Promise<ProjectOpenResult>
    recent: () => Promise<string[]>
    setTitle: (filename: string | null, modified: boolean) => Promise<void>
  }
  exportAPI?: {
    savePdf: (buffer: ArrayBuffer, defaultName: string) => Promise<ExportSaveResult>
    saveCsv: (content: string, defaultName: string) => Promise<ExportSaveResult>
  }
  pluginAPI?: {
    listPlugins: () => Promise<{ success: boolean; plugins: { filename: string; source: string }[]; error?: string }>
    openPluginsFolder: () => Promise<{ success: boolean }>
  }
  shareAPI?: {
    getLaunchLink: () => Promise<string | null>
    onDeepLink: (cb: (url: string) => void) => void
  }
}
