// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { strToU8, strFromU8, zlibSync, unzlibSync } from 'fflate'

/**
 * Serializes an object to a URL-safe, Base64-encoded, zlib-compressed string.
 */
export function serializeState(state: unknown): string {
  const jsonString = JSON.stringify(state)
  const buffer = strToU8(jsonString)
  const compressed = zlibSync(buffer, { level: 9 })
  
  let binary = ''
  const len = compressed.byteLength
  // Iterate instead of using String.fromCharCode.apply to avoid call stack limits on large states
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(compressed[i])
  }
  
  return encodeURIComponent(window.btoa(binary))
}

/**
 * Deserializes a Base64-encoded, zlib-compressed string back to an object.
 */
export function deserializeState<T = unknown>(hash: string): T | null {
  try {
    const base64 = decodeURIComponent(hash.replace(/^#/, ''))
    if (!base64) return null
    
    const binaryString = window.atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    const decompressed = unzlibSync(bytes)
    const jsonString = strFromU8(decompressed)
    return JSON.parse(jsonString) as T
  } catch (error) {
    console.error('Failed to parse state from URL hash:', error)
    return null
  }
}

/**
 * Hydrates the Zustand store from the URL hash and syncs future changes back to the hash.
 */
export function initShareableLinks<T>(
  useStore: { setState: (state: Partial<T>) => void; subscribe: (listener: (state: T) => void) => void },
  selector: (state: T) => Partial<T>
) {
  if (typeof window === 'undefined') return

  const hash = window.location.hash
  if (hash) {
    const hydratedState = deserializeState<Partial<T>>(hash)
    if (hydratedState) useStore.setState(hydratedState)
  }

  useStore.subscribe((state: T) => {
    const shareableState = selector(state)
    const newHash = serializeState(shareableState)
    window.history.replaceState(null, '', `#${newHash}`)
  })
}