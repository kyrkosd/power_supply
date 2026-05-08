import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupLTspiceIPC } from './ltspice-bridge'
import { setupProjectIPC } from './file-handlers'
import { setupExportIPC } from './export-handlers'
import { setupDigiKeyIPC } from './digikey-bridge'
import { setupPluginIPC } from './plugin-ipc'

// ── pswb:// deep-link handling ────────────────────────────────────────────────

// Register as the default handler for pswb:// links on all platforms.
// Must be called before app.whenReady() on Windows and Linux.
if (process.platform !== 'darwin') {
  app.setAsDefaultProtocolClient('pswb')
}

// Buffer a deep-link URL received before the renderer window is ready.
let pendingDeepLink: string | null = null

function extractPswbUrl(argv: string[]): string | null {
  const link = argv.find(arg => arg.startsWith('pswb://'))
  return link ?? null
}

function sendDeepLink(win: BrowserWindow, url: string): void {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => win.webContents.send('share:deep-link', url))
  } else {
    win.webContents.send('share:deep-link', url)
  }
}

// Windows / Linux: pswb:// arrives as a command-line argument on first launch,
// or via second-instance when the app is already running.
app.on('second-instance', (_event, argv) => {
  const url = extractPswbUrl(argv)
  if (!url) return
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    const win = wins[0]
    if (win.isMinimized()) win.restore()
    win.focus()
    sendDeepLink(win, url)
  }
})

// macOS: pswb:// is delivered via this event (app may or may not be running).
app.on('open-url', (event, url) => {
  event.preventDefault()
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    sendDeepLink(wins[0], url)
  } else {
    pendingDeepLink = url
  }
})

// ── Window factory ────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
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

  win.on('ready-to-show', () => {
    win.show()
    // Deliver any deep-link that arrived before the window was ready
    if (pendingDeepLink) {
      win.webContents.send('share:deep-link', pendingDeepLink)
      pendingDeepLink = null
    }
  })

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

  return win
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Single-instance lock — required for Windows second-instance deep-link handling.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.whenReady().then(() => {
  // macOS: register protocol after ready
  if (process.platform === 'darwin') {
    app.setAsDefaultProtocolClient('pswb')
  }

  // Check for a pswb:// URL passed as a CLI argument at first launch (Windows/Linux)
  const launchUrl = extractPswbUrl(process.argv)
  if (launchUrl) pendingDeepLink = launchUrl

  electronApp.setAppUserModelId('com.power-supply-workbench')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // Register all IPC channels before the window is created
  setupLTspiceIPC()
  setupProjectIPC()
  setupExportIPC()
  setupDigiKeyIPC()
  setupPluginIPC()

  // Allow renderer to request the pending deep-link synchronously on startup
  ipcMain.handle('share:get-launch-link', () => {
    const url = pendingDeepLink
    pendingDeepLink = null
    return url
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
