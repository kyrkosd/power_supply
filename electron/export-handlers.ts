import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fsp } from 'fs'

export function setupExportIPC(): void {
  ipcMain.handle('export:save-pdf', async (event, payload: { buffer: ArrayBuffer; defaultName: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Export PDF Report',
      defaultPath: payload.defaultName,
      filters: [
        { name: 'PDF Document', extensions: ['pdf'] },
        { name: 'All Files',    extensions: ['*'] },
      ],
    })

    if (canceled || !filePath) return { success: false, error: 'Cancelled' }

    try {
      await fsp.writeFile(filePath, Buffer.from(payload.buffer))
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('export:save-csv', async (event, payload: { content: string; defaultName: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Export Bill of Materials',
      defaultPath: payload.defaultName,
      filters: [
        { name: 'CSV File',  extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (canceled || !filePath) return { success: false, error: 'Cancelled' }

    try {
      await fsp.writeFile(filePath, payload.content, 'utf-8')
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
