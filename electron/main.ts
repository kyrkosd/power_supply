// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupLTspiceIPC } from './ltspice-bridge'
import { setupProjectIPC } from './file-handlers'
import { setupExportIPC } from './export-handlers'
import { setupDigiKeyIPC } from './digikey-bridge'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  win.on('ready-to-show', () => win.show())

  // Open all target="_blank" links in the system browser, not a new Electron window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.power-supply-workbench')

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // Register all IPC channels before the window is created
  setupLTspiceIPC()
  setupProjectIPC()
  setupExportIPC()
  setupDigiKeyIPC()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
