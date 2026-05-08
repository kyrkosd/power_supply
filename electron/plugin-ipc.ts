import { ipcMain, app, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'

function pluginsDir(): string {
  return join(app.getPath('userData'), 'plugins')
}

function ensurePluginsDir(): void {
  const dir = pluginsDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function setupPluginIPC(): void {
  ipcMain.handle('plugin:list', async () => {
    try {
      ensurePluginsDir()
      const dir = pluginsDir()
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
      const plugins: { filename: string; source: string }[] = []
      for (const filename of files) {
        try {
          const source = fs.readFileSync(join(dir, filename), 'utf-8')
          plugins.push({ filename, source })
        } catch {
          // unreadable file — skip silently
        }
      }
      return { success: true, plugins }
    } catch (err) {
      return { success: false, plugins: [], error: String(err) }
    }
  })

  ipcMain.handle('plugin:open-folder', async () => {
    ensurePluginsDir()
    await shell.openPath(pluginsDir())
    return { success: true }
  })
}
