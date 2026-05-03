import { ipcMain, dialog, app, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { promises as fsp } from 'fs'
import { join } from 'path'

const MAX_RECENT = 5

// Lazy so app.getPath() is not called before app is ready
function getRecentFile(): string {
  return join(app.getPath('userData'), 'recent-projects.json')
}

async function loadRecent(): Promise<string[]> {
  try {
    const data = await fsp.readFile(getRecentFile(), 'utf-8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function addToRecent(filePath: string): Promise<void> {
  const recent = await loadRecent()
  const updated = [filePath, ...recent.filter(p => p !== filePath)].slice(0, MAX_RECENT)
  await fsp.writeFile(getRecentFile(), JSON.stringify(updated), 'utf-8').catch(() => {})
}

function setWindowTitle(event: IpcMainInvokeEvent, filename: string | null, modified: boolean): void {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  const name = filename ? filename.replace(/.*[\\/]/, '') : 'Untitled'
  win.setTitle(`Power Supply Workbench — ${name}${modified ? ' •' : ''}`)
}

export function setupProjectIPC(): void {
  // Save to a known path (no dialog)
  ipcMain.handle('project:save', async (event, payload: { content: string; filePath: string }) => {
    try {
      await fsp.writeFile(payload.filePath, payload.content, 'utf-8')
      await addToRecent(payload.filePath)
      setWindowTitle(event, payload.filePath, false)
      return { success: true, filePath: payload.filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Always show save dialog
  ipcMain.handle('project:save-as', async (event, content: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Save Project',
      defaultPath: 'my-design.pswb',
      filters: [
        { name: 'Power Supply Workbench', extensions: ['pswb'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (canceled || !filePath) return { success: false, error: 'Cancelled' }
    try {
      await fsp.writeFile(filePath, content, 'utf-8')
      await addToRecent(filePath)
      setWindowTitle(event, filePath, false)
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Show open dialog, read and parse file
  ipcMain.handle('project:open', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Open Project',
      filters: [
        { name: 'Power Supply Workbench', extensions: ['pswb'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { success: false, error: 'Cancelled' }
    const filePath = filePaths[0]
    try {
      const content = await fsp.readFile(filePath, 'utf-8')
      const project = JSON.parse(content)
      await addToRecent(filePath)
      setWindowTitle(event, filePath, false)
      return { success: true, filePath, project }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Return last 5 opened paths
  ipcMain.handle('project:recent', async () => {
    return loadRecent()
  })

  // Update native window title from renderer (e.g. on isModified change)
  ipcMain.handle('project:set-title', async (event, payload: { filename: string | null; modified: boolean }) => {
    setWindowTitle(event, payload.filename, payload.modified)
  })
}
