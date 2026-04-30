import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { join, dirname, parse, basename } from 'path';
import { promises as fsp } from 'fs';

export function detectLTspicePath(): string | null {
  const platform = os.platform();
  let searchPaths: string[] = [];

  if (platform === 'win32') {
    searchPaths = [
      'C:\\Program Files\\ADI\\LTspice\\LTspice.exe',
      'C:\\Program Files\\LTC\\LTspiceXVII\\XVIIx64.exe',
      'C:\\Program Files\\LTC\\LTspiceXVII\\XVIIx86.exe'
    ];
  } else if (platform === 'darwin') {
    searchPaths = [
      '/Applications/LTspice.app/Contents/MacOS/LTspice'
    ];
  }

  return searchPaths.find(p => fs.existsSync(p)) || null;
}

export function exportNetlist(asc_content: string, filepath: string): void {
  fs.writeFileSync(filepath, asc_content, 'utf-8');
}

export async function runSimulation(asc_path: string): Promise<{ rawPath: string; logPath: string }> {
  const ltspicePath = detectLTspicePath();
  if (!ltspicePath) {
    throw new Error('LTspice executable not found. Please check installation paths.');
  }

  return new Promise((resolve, reject) => {
    const process = spawn(ltspicePath, ['-b', asc_path], {
      cwd: dirname(asc_path),
    });

    const timeout = setTimeout(() => {
      process.kill();
      reject(new Error('LTspice simulation timed out after 60 seconds.'));
    }, 60000);

    let stderr = '';
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(new Error(`LTspice exited with code ${code}. Stderr: ${stderr}`));
      }

      const { dir, name } = parse(asc_path);
      
      // Validate and sanitize to prevent path traversal
      if (asc_path.includes('..') || asc_path.indexOf('\0') !== -1) {
        return reject(new Error('Invalid path: Directory traversal detected.'));
      }

      const safeName = basename(name);
      const rawPath = join(dir, `${safeName}.raw`);
      const logPath = join(dir, `${safeName}.log`);

      if (!fs.existsSync(rawPath) || !fs.existsSync(logPath)) {
        return reject(new Error('LTspice did not produce expected .raw and .log output files.'));
      }
      resolve({ rawPath, logPath });
    });

    process.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start LTspice process: ${err.message}`));
    });
  });
}

export function setupLTspiceIPC() {
  ipcMain.handle('ltspice:export', async (event, asc_content: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export LTspice Netlist',
      defaultPath: 'buck_converter.asc',
      filters: [{ name: 'LTspice ASC', extensions: ['asc'] }, { name: 'All Files', extensions: ['*'] }]
    });

    if (canceled || !filePath) return { success: false, error: 'User canceled' };

    try {
      exportNetlist(asc_content, filePath);
      return { success: true, filePath };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('ltspice:run-comparison', async (event, asc_content: string) => {
    const tempDir = os.tmpdir();
    const tempAscPath = join(tempDir, `pswb-sim-${Date.now()}.asc`);

    try {
      await fsp.writeFile(tempAscPath, asc_content, 'utf-8');

      const { rawPath, logPath } = await runSimulation(tempAscPath);

      const rawContent = await fsp.readFile(rawPath, 'utf-8');
      const logContent = await fsp.readFile(logPath, 'utf-8');

      // Clean up temp files
      await Promise.all([
        fsp.unlink(tempAscPath),
        fsp.unlink(rawPath),
        fsp.unlink(logPath),
        fsp.unlink(rawPath.replace('.raw', '.op.raw')).catch(() => {}), // Optional .op file
      ]);

      return { success: true, rawContent, logContent };
    } catch (err: unknown) {
      if (fs.existsSync(tempAscPath)) {
        await fsp.unlink(tempAscPath).catch(() => {});
      }
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}