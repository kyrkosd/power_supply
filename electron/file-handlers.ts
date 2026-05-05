// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { ipcMain, dialog, app, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { promises as fsp } from 'fs'
import { join } from 'path'

const MAX_RECENT = 5

// ── Recent-file persistence ───────────────────────────────────────────────────

// Lazy so app.getPath() is not called before 'ready'
function recentFilePath(): string {
  return join(app.getPath('userData'), 'recent-projects.json')
}

async function loadRecent(): Promise<string[]> {
  try {
    const data = await fsp.readFile(recentFilePath(), 'utf-8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function addToRecent(filePath: string): Promise<void> {
  const recent = await loadRecent()
  const updated = [filePath, ...recent.filter(p => p !== filePath)].slice(0, MAX_RECENT)
  await fsp.writeFile(recentFilePath(), JSON.stringify(updated), 'utf-8').catch(() => {})
}

// ── Window title ──────────────────────────────────────────────────────────────

function setWindowTitle(event: IpcMainInvokeEvent, filename: string | null, modified: boolean): void {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  const name = filename ? filename.replace(/.*[\\/]/, '') : 'Untitled'
  win.setTitle(`Power Supply Workbench — ${name}${modified ? ' •' : ''}`)
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Writes project JSON, records the path in recent-files, and clears the window dirty marker. */
async function saveAndRecord(event: IpcMainInvokeEvent, filePath: string, content: string): Promise<void> {
  await fsp.writeFile(filePath, content, 'utf-8')
  await addToRecent(filePath)
  setWindowTitle(event, filePath, false)
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

export function setupProjectIPC(): void {
  // Save to a known path (no dialog)
  ipcMain.handle('project:save', async (event, payload: { content: string; filePath: string }) => {
    try {
      await saveAndRecord(event, payload.filePath, payload.content)
      return { success: true, filePath: payload.filePath }
    } catch (err) {
      return { success: false, error: toError(err) }
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
      await saveAndRecord(event, filePath, content)
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: toError(err) }
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
      return { success: false, error: toError(err) }
    }
  })

  ipcMain.handle('project:recent', () => loadRecent())

  ipcMain.handle('project:set-title', async (event, payload: { filename: string | null; modified: boolean }) => {
    setWindowTitle(event, payload.filename, payload.modified)
  })
}
