import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import { spawn } from 'child_process'
import { join, dirname, parse, basename } from 'path'
import { promises as fsp } from 'fs'

const SIMULATION_TIMEOUT_MS = 60_000

// ── LTspice discovery ─────────────────────────────────────────────────────────

export function detectLTspicePath(): string | null {
  const platform = os.platform()
  const searchPaths: string[] =
    platform === 'win32'
      ? [
          'C:\\Program Files\\ADI\\LTspice\\LTspice.exe',
          'C:\\Program Files\\LTC\\LTspiceXVII\\XVIIx64.exe',
          'C:\\Program Files\\LTC\\LTspiceXVII\\XVIIx86.exe',
        ]
      : platform === 'darwin'
        ? ['/Applications/LTspice.app/Contents/MacOS/LTspice']
        : []
  return searchPaths.find(p => fs.existsSync(p)) ?? null
}

// ── File utilities ────────────────────────────────────────────────────────────

export function exportNetlist(asc_content: string, filepath: string): void {
  fs.writeFileSync(filepath, asc_content, 'utf-8')
}

/**
 * Derives the expected .raw and .log output paths from an .asc input path.
 * Throws on path-traversal attempts before any file I/O occurs.
 */
function resolveOutputPaths(asc_path: string): { rawPath: string; logPath: string } {
  if (asc_path.includes('..') || asc_path.indexOf('\0') !== -1) {
    throw new Error('Invalid path: directory traversal detected.')
  }
  const { dir, name } = parse(asc_path)
  const safeName = basename(name)
  return {
    rawPath: join(dir, `${safeName}.raw`),
    logPath: join(dir, `${safeName}.log`),
  }
}

// ── Process management ────────────────────────────────────────────────────────

/**
 * Spawns LTspice in batch mode and resolves with the output file paths.
 * Rejects if the process errors, exits non-zero, or exceeds SIMULATION_TIMEOUT_MS.
 */
function spawnSimulation(ltspicePath: string, asc_path: string): Promise<{ rawPath: string; logPath: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ltspicePath, ['-b', asc_path], { cwd: dirname(asc_path) })

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`LTspice simulation timed out after ${SIMULATION_TIMEOUT_MS / 1000} seconds.`))
    }, SIMULATION_TIMEOUT_MS)

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to start LTspice: ${err.message}`))
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        return reject(new Error(`LTspice exited with code ${code}. Stderr: ${stderr}`))
      }
      try {
        const paths = resolveOutputPaths(asc_path)
        if (!fs.existsSync(paths.rawPath) || !fs.existsSync(paths.logPath)) {
          return reject(new Error('LTspice did not produce expected .raw and .log output files.'))
        }
        resolve(paths)
      } catch (err) {
        reject(err)
      }
    })
  })
}

export async function runSimulation(asc_path: string): Promise<{ rawPath: string; logPath: string }> {
  const ltspicePath = detectLTspicePath()
  if (!ltspicePath) throw new Error('LTspice executable not found. Please check installation paths.')
  return spawnSimulation(ltspicePath, asc_path)
}

// ── Temp-file simulation ──────────────────────────────────────────────────────

/**
 * Writes netlist content to a temp file, runs a simulation, reads back the
 * output files, then deletes all temp files whether the simulation succeeded or not.
 */
async function runTempSimulation(asc_content: string): Promise<{ rawContent: string; logContent: string }> {
  const tempAscPath = join(os.tmpdir(), `pswb-sim-${Date.now()}.asc`)
  await fsp.writeFile(tempAscPath, asc_content, 'utf-8')
  try {
    const { rawPath, logPath } = await runSimulation(tempAscPath)
    const [rawContent, logContent] = await Promise.all([
      fsp.readFile(rawPath, 'utf-8'),
      fsp.readFile(logPath, 'utf-8'),
    ])
    await Promise.all([
      fsp.unlink(tempAscPath),
      fsp.unlink(rawPath),
      fsp.unlink(logPath),
      fsp.unlink(rawPath.replace('.raw', '.op.raw')).catch(() => {}),
    ])
    return { rawContent, logContent }
  } catch (err) {
    await fsp.unlink(tempAscPath).catch(() => {})
    throw err
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────

export function setupLTspiceIPC(): void {
  ipcMain.handle('ltspice:export', async (_event, asc_content: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export LTspice Netlist',
      defaultPath: 'buck_converter.asc',
      filters: [
        { name: 'LTspice ASC', extensions: ['asc'] },
        { name: 'All Files',   extensions: ['*'] },
      ],
    })
    if (canceled || !filePath) return { success: false, error: 'User canceled' }
    try {
      exportNetlist(asc_content, filePath)
      return { success: true, filePath }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('ltspice:run-comparison', async (_event, asc_content: string) => {
    try {
      const result = await runTempSimulation(asc_content)
      return { success: true, ...result }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
