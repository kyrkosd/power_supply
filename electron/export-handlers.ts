import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fsp } from 'fs'

interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Shows a native save dialog, then writes data to the chosen path.
 * Both export channels share this pattern — keep it in one place.
 */
async function saveFileWithDialog(
  event: Electron.IpcMainInvokeEvent,
  dialogOpts: Electron.SaveDialogOptions,
  write: (filePath: string) => Promise<void>
): Promise<SaveResult> {
  const win = BrowserWindow.fromWebContents(event.sender)
  const { canceled, filePath } = await dialog.showSaveDialog(win!, dialogOpts)
  if (canceled || !filePath) return { success: false, error: 'Cancelled' }
  try {
    await write(filePath)
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: errMsg(err) }
  }
}

export function setupExportIPC(): void {
  ipcMain.handle('export:save-pdf', (event, payload: { buffer: ArrayBuffer; defaultName: string }) =>
    saveFileWithDialog(
      event,
      {
        title: 'Export PDF Report',
        defaultPath: payload.defaultName,
        filters: [
          { name: 'PDF Document', extensions: ['pdf'] },
          { name: 'All Files',    extensions: ['*'] },
        ],
      },
      (fp) => fsp.writeFile(fp, Buffer.from(payload.buffer))
    )
  )

  ipcMain.handle('export:save-csv', (event, payload: { content: string; defaultName: string }) =>
    saveFileWithDialog(
      event,
      {
        title: 'Export Bill of Materials',
        defaultPath: payload.defaultName,
        filters: [
          { name: 'CSV File',  extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      },
      (fp) => fsp.writeFile(fp, payload.content, 'utf-8')
    )
  )
}
