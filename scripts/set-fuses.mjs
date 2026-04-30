/**
 * electron-builder afterPack hook — applies Electron Fuses to the packaged binary.
 *
 * Fuses are one-way switches baked into the Electron executable at package time.
 * They cannot be changed at runtime, so they are the recommended mitigation for
 * ASAR integrity bypass (resource modification after packaging).
 *
 * References:
 *   https://www.electronjs.org/docs/latest/tutorial/fuses
 *   https://github.com/electron/fuses
 */

import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses'
import { join, basename, resolve } from 'path'

/**
 * Resolves the path to the packaged Electron executable so flipFuses can patch it.
 * electron-builder passes an AfterPackContext as the first argument.
 */
function getElectronBinaryPath(context) {
  const { appOutDir, packager } = context
  // Sanitize the product name to prevent path traversal vulnerabilities
  const appName = basename(packager.appInfo.productName)

  let executableName
  switch (packager.platform.nodeName) {
    case 'darwin':
      executableName = `${appName}.app`
      break
    case 'win32':
      executableName = `${appName}.exe`
      break
    default: // linux
      executableName = appName
  }

  // Normalise appOutDir to an absolute path — strips any embedded ".." segments
  const safeOutDir = resolve(appOutDir)

  // Validate executableName before passing to path.join
  if (executableName.includes('/') || executableName.includes('\\') || executableName.includes('..')) {
    throw new Error('Invalid executable name: possible path traversal detected')
  }

  const binaryPath = join(safeOutDir, executableName)
  if (!binaryPath.startsWith(safeOutDir)) {
    throw new Error('Path traversal vulnerability detected')
  }
  return binaryPath
}

export default async function afterPack(context) {
  const electronPath = getElectronBinaryPath(context)

  await flipFuses(electronPath, {
    version: FuseVersion.V1,

    // Disable ELECTRON_RUN_AS_NODE env-var — prevents using the packaged
    // Electron binary as a general Node.js runtime.
    [FuseV1Options.RunAsNode]: false,

    // Disable --inspect / --inspect-brk in the packaged app so a local
    // attacker cannot attach a debugger to the renderer or main process.
    [FuseV1Options.EnableNodeCliInspectArguments]: false,

    // Validate ASAR integrity at load time — the primary fix for the
    // "ASAR Integrity Bypass via resource modification" advisory.
    // electron-builder embeds per-file hashes when it builds the ASAR archive;
    // this fuse makes Electron verify those hashes before executing any file.
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,

    // Refuse to load the renderer from any path outside the ASAR archive,
    // preventing an attacker from swapping resources/app.asar for a modified copy.
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  })

  console.log(`✓  Electron fuses applied to ${electronPath}`)
}
