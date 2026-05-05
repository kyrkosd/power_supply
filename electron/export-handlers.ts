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
}
