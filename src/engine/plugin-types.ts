import type { DesignSpec, DesignResult } from './types'
import type { WaveformSet } from './topologies/types'
import type { TransferFunction } from './types'

// ── Interfaces ────────────────────────────────────────────────────────────────

/**
 * Descriptor for a single user-adjustable parameter exposed by a plugin topology.
 * Rendered as a labeled slider in the InputPanel alongside the built-in fields.
 */
export interface PluginCustomInput {
  key: string
  label: string
  unit: string
  min: number
  max: number
  default: number
  logScale?: boolean
}

/**
 * Contract that every community topology plugin must satisfy.
 *
 * Plugins are loaded as plain `.js` files from `userData/plugins/` and evaluated
 * inside the Web Worker via `new Function()` (no DOM, no Node, no `import`).
 *
 * **Required fields:** `id`, `name`, `version`, `author`, `description`, `compute`.
 * **Optional fields:** transfer-function, waveforms, schematic SVG, custom inputs,
 * default spec overrides.
 */
export interface TopologyPlugin {
  /** Unique identifier — must match the plugin filename stem (e.g. `'cuk'`). */
  id: string
  name: string
  version: string
  author: string
  description: string
  /** Core computation: maps a DesignSpec to a complete DesignResult. */
  compute(spec: DesignSpec): DesignResult
  /** Optional: small-signal transfer function for the Bode Plot tab. */
  getTransferFunction?(spec: DesignSpec, result: DesignResult): TransferFunction
  /** Optional: time-domain waveforms for the Waveforms tab. */
  generateWaveforms?(spec: DesignSpec): WaveformSet
  /** Optional: returns an SVG string rendered in the Schematic tab. */
  getSchematicSVG?(): string
  customInputs?: PluginCustomInput[]
  defaultSpec?: Partial<DesignSpec>
}

/**
 * Lightweight metadata returned to the renderer after a plugin is loaded.
 * The full plugin object stays inside the worker sandbox.
 */
export interface PluginMeta {
  id: string
  name: string
  version: string
  author: string
  description: string
  filename: string
  enabled: boolean
  /** Present when the plugin failed to load or failed `validatePlugin`. */
  error?: string
}

/** Raw source payload delivered from the main process to the worker. */
export interface PluginSource {
  filename: string
  source: string
}

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Returns true when `id` and `name` are non-empty strings.
 * These two fields are used as keys in the registry and must never be blank.
 */
function hasRequiredIds(p: Record<string, unknown>): boolean {
  return typeof p.id === 'string' && p.id.length > 0
      && typeof p.name === 'string' && p.name.length > 0
}

/**
 * Returns true when the informational metadata fields are present as strings.
 * `version`, `author`, and `description` may be empty but must exist.
 */
function hasRequiredMetadata(p: Record<string, unknown>): boolean {
  return typeof p.version     === 'string'
      && typeof p.author      === 'string'
      && typeof p.description === 'string'
}

/**
 * Returns true when the plugin exposes a callable `compute` function.
 * This is the only required behaviour beyond identity fields.
 */
function hasComputeFunction(p: Record<string, unknown>): boolean {
  return typeof p.compute === 'function'
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Type guard that confirms an unknown value satisfies the `TopologyPlugin` interface.
 *
 * Called by the worker immediately after sandboxed plugin evaluation so that
 * malformed plugins are rejected before they can reach the compute pipeline.
 */
export function validatePlugin(obj: unknown): obj is TopologyPlugin {
  if (!obj || typeof obj !== 'object') return false
  const p = obj as Record<string, unknown>
  return hasRequiredIds(p) && hasRequiredMetadata(p) && hasComputeFunction(p)
}
