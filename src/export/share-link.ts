import { zlibSync, unzlibSync, strToU8, strFromU8 } from 'fflate'
import type { DesignSpec } from '../engine/types'
import type { TopologyId } from '../store/workbenchStore'

// Version prefix for the pswb:// custom protocol.
// Bump the version number if the serialisation format changes in a breaking way.
const PREFIX = 'pswb://v1/'

export interface ShareableDesign {
  topology: TopologyId | string
  spec: DesignSpec
  overrides: Record<string, unknown>
}

// ── Base64url helpers (URL-safe, no padding) ──────────────────────────────────

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64Url(b64url: string): string {
  const padLen = b64url.length % 4
  const pad = padLen === 0 ? '' : '='.repeat(4 - padLen)
  return b64url.replace(/-/g, '+').replace(/_/g, '/') + pad
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encodes topology + spec + component overrides into a pswb://v1/<base64url>
 * string suitable for sharing via chat, email, or clipboard.
 *
 * Uses zlib deflate (level 9) to keep the payload well under 2000 characters
 * for typical designs.
 */
export function encodeDesign(
  topology: TopologyId | string,
  spec: DesignSpec,
  overrides: Record<string, unknown> = {},
): string {
  const payload: ShareableDesign = { topology, spec, overrides }
  const json = JSON.stringify(payload)
  const compressed = zlibSync(strToU8(json), { level: 9 })

  // Build binary string for btoa (avoid call-stack limit with a loop)
  let binary = ''
  for (let i = 0; i < compressed.byteLength; i++) {
    binary += String.fromCharCode(compressed[i])
  }
  return PREFIX + toBase64Url(btoa(binary))
}

/**
 * Decodes a pswb://v1/<base64url> string produced by encodeDesign.
 * Returns null when the input is missing, has the wrong version prefix,
 * is corrupted, or does not contain the required fields.
 */
export function decodeDesign(encoded: string): ShareableDesign | null {
  try {
    if (!encoded.startsWith(PREFIX)) return null
    const b64url = encoded.slice(PREFIX.length)
    if (!b64url) return null

    const binary = atob(fromBase64Url(b64url))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const json = strFromU8(unzlibSync(bytes))
    const parsed = JSON.parse(json) as unknown

    if (!parsed || typeof parsed !== 'object') return null
    const p = parsed as Record<string, unknown>

    if (typeof p.topology !== 'string' || !p.topology) return null
    if (!p.spec || typeof p.spec !== 'object') return null

    return {
      topology: p.topology as TopologyId | string,
      spec: p.spec as DesignSpec,
      overrides: (p.overrides && typeof p.overrides === 'object')
        ? (p.overrides as Record<string, unknown>)
        : {},
    }
  } catch {
    return null
  }
}

/** Returns true when a string looks like a valid pswb:// link. */
export function isPswbLink(text: string): boolean {
  return text.trimStart().startsWith(PREFIX)
}
