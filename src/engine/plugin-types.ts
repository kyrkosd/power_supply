import type { DesignSpec, DesignResult } from './types'
import type { WaveformSet } from './topologies/types'
import type { TransferFunction } from './types'

export interface PluginCustomInput {
  key: string
  label: string
  unit: string
  min: number
  max: number
  default: number
  logScale?: boolean
}

export interface TopologyPlugin {
  id: string
  name: string
  version: string
  author: string
  description: string
  compute(spec: DesignSpec): DesignResult
  getTransferFunction?(spec: DesignSpec, result: DesignResult): TransferFunction
  generateWaveforms?(spec: DesignSpec): WaveformSet
  getSchematicSVG?(): string
  customInputs?: PluginCustomInput[]
  defaultSpec?: Partial<DesignSpec>
}

export interface PluginMeta {
  id: string
  name: string
  version: string
  author: string
  description: string
  filename: string
  enabled: boolean
  error?: string
}

export interface PluginSource {
  filename: string
  source: string
}

export function validatePlugin(obj: unknown): obj is TopologyPlugin {
  if (!obj || typeof obj !== 'object') return false
  const p = obj as Record<string, unknown>
  return (
    typeof p.id === 'string' && p.id.length > 0 &&
    typeof p.name === 'string' && p.name.length > 0 &&
    typeof p.version === 'string' &&
    typeof p.author === 'string' &&
    typeof p.description === 'string' &&
    typeof p.compute === 'function'
  )
}
