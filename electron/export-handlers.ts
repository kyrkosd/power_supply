// This module defines IPC handlers for exporting data (PDFs, CSVs) from the app.
// The handlers prompt the user for a save location (via the native dialog) and then
// write the data to disk. The handlers return a `SaveResult` indicating success or
// failure, along with any relevant details (e.g. error message on failure).
// The main export is `setupExportIPC()`, which registers all handlers. Call this
// once during app initialization.
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fsp } from 'fs'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}

// ── Low-level helpers ─────────────────────────────────────────────────────────

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Returns the BrowserWindow that owns the IPC event's web contents. */
function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  return BrowserWindow.fromWebContents(event.sender)!
}

/**
 * Opens a native save dialog attached to `win`.
 * Returns the chosen path, or `null` when the user cancels.
 */
async function promptSavePath(
  win: BrowserWindow,
  opts: Electron.SaveDialogOptions,
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(win, opts)
  return canceled || !filePath ? null : filePath
}

/**
 * Calls `write` with the given path and wraps the outcome in a `SaveResult`.
 * Any thrown error is caught and surfaced as `{ success: false, error }`.
 */
async function writeWithResult(
  filePath: string,
  write: (path: string) => Promise<void>,
): Promise<SaveResult> {
  try {
    await write(filePath)
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: errMsg(err) }
  }
}

// ── Dialog-filter constants ───────────────────────────────────────────────────

const PDF_FILTERS: Electron.FileFilter[] = [
  { name: 'PDF Document', extensions: ['pdf'] },
  { name: 'All Files',    extensions: ['*'] },
]

const CSV_FILTERS: Electron.FileFilter[] = [
  { name: 'CSV File',  extensions: ['csv'] },
  { name: 'All Files', extensions: ['*'] },
]

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Prompts the user for a save path (via the native dialog) and then writes
 * data to that path. Returns a `SaveResult` describing the outcome.
 */
async function saveFileWithDialog(
  event: Electron.IpcMainInvokeEvent,
  opts: Electron.SaveDialogOptions,
  write: (path: string) => Promise<void>,
): Promise<SaveResult> {
  const filePath = await promptSavePath(senderWindow(event), opts)
  if (!filePath) return { success: false, error: 'Cancelled' }
  return writeWithResult(filePath, write)
}

// ── IPC handler registrations ─────────────────────────────────────────────────

/** Registers the `export:save-pdf` channel. */
function registerPdfHandler(): void {
  ipcMain.handle(
    'export:save-pdf',
    (event, payload: { buffer: ArrayBuffer; defaultName: string }) =>
      saveFileWithDialog(
        event,
        { title: 'Export PDF Report', defaultPath: payload.defaultName, filters: PDF_FILTERS },
        (fp) => fsp.writeFile(fp, Buffer.from(payload.buffer)),
      ),
  )
}

/** Registers the `export:save-csv` channel. */
function registerCsvHandler(): void {
  ipcMain.handle(
    'export:save-csv',
    (event, payload: { content: string; defaultName: string }) =>
      saveFileWithDialog(
        event,
        { title: 'Export Bill of Materials', defaultPath: payload.defaultName, filters: CSV_FILTERS },
        (fp) => fsp.writeFile(fp, payload.content, 'utf-8'),
      ),
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Registers all export-related IPC handlers. Call once during app startup. */
export function setupExportIPC(): void {
  registerPdfHandler()
  registerCsvHandler()
}
