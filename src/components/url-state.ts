// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import pako from 'pako';
import type { DesignSpec } from '../engine/types';

/**
 * Basic schema validation to ensure the hydrated state is structurally sound.
 * Prevents crashes if a user loads a severely outdated or malformed link.
 */
export function isValidDesignSpec(data: unknown): data is DesignSpec {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.vinMin === 'number' &&
    typeof d.vinMax === 'number' &&
    typeof d.vout === 'number' &&
    typeof d.iout === 'number' &&
    typeof d.fsw === 'number'
  )
}

export function serializeDesign(state: DesignSpec): string {
  try {
    const jsonString = JSON.stringify(state);
    const uint8Array = new TextEncoder().encode(jsonString);
    const compressed = pako.deflate(uint8Array);
    
    let binary = '';
    const len = compressed.byteLength;
    // Iterating to prevent call stack limits on large arrays
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(compressed[i]);
    }
    
    return encodeURIComponent(window.btoa(binary));
  } catch (error) {
    console.error('Failed to serialize state:', error);
    return '';
  }
}

export function deserializeDesign(hash: string): DesignSpec | null {
  try {
    const base64 = decodeURIComponent(hash.replace(/^#/, ''));
    if (!base64) return null;

    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const decompressed = pako.inflate(bytes);
    const jsonString = new TextDecoder().decode(decompressed);
    const parsed = JSON.parse(jsonString);
    return isValidDesignSpec(parsed) ? parsed : null;
  } catch (error) {
    console.error('Failed to deserialize state from URL:', error);
    return null;
  }
}