import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import { spawn } from 'child_process'
import { join, dirname, parse, basename } from 'path'
import { promises as fsp } from 'fs'

const SIMULATION_TIMEOUT_MS = 60_000

// ── LTspice discovery ─────────────────────────────────────────────────────────

// Exhaustive list of known LTspice installation paths per platform.
// Shared between detectLTspicePath() and assertTrustedExecutable() so the
// whitelist is defined exactly once and both functions stay in sync.
const KNOWN_LTSPICE_PATHS: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: [
    'C:\\Program Files\\ADI\\LTspice\\LTspice.exe',
    'C:\\Program Files\\LTC\\LTspiceXVII\\XVIIx64.exe',
    'C:\\Program Files\\LTC\\LTspiceXVII\\XVIIx86.exe',
  ],
  darwin: ['/Applications/LTspice.app/Contents/MacOS/LTspice'],
}

export function detectLTspicePath(): string | null {
  const candidates = KNOWN_LTSPICE_PATHS[os.platform()] ?? []
  return candidates.find(p => fs.existsSync(p)) ?? null
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
 *
 * The executable path is resolved internally from KNOWN_LTSPICE_PATHS — it is
 * never accepted as a parameter, so no caller-supplied value can reach spawn().
 */
function spawnSimulation(asc_path: string): Promise<{ rawPath: string; logPath: string }> {
  // Resolve the executable from the module-level whitelist, not from any argument.
  const exePath = detectLTspicePath()
  if (!exePath) throw new Error('LTspice executable not found. Please check installation paths.')

  // Validate the .asc path before the Promise is constructed so no process
  // is started if the path contains traversal sequences or null bytes.
  const { rawPath, logPath } = resolveOutputPaths(asc_path)

  return new Promise((resolve, reject) => {
    const proc = spawn(exePath, ['-b', asc_path], {
      cwd: dirname(asc_path),
      shell: false, // explicit: never invoke a shell
    })

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
      if (!fs.existsSync(rawPath) || !fs.existsSync(logPath)) {
        return reject(new Error('LTspice did not produce expected .raw and .log output files.'))
      }
      resolve({ rawPath, logPath })
    })
  })
}

export function runSimulation(asc_path: string): Promise<{ rawPath: string; logPath: string }> {
  return spawnSimulation(asc_path)
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
