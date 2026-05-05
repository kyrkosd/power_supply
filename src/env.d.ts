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
  }
}
