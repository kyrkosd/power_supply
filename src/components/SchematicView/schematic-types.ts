import type { DesignSpec, DesignResult } from '../../engine/types'

export type ComponentStatus = 'normal' | 'warning' | 'violation'

export type SchematicNode = { id: string; x: number; y: number }

export type SchematicComponent = {
  id:     string
  type:   'source' | 'switch' | 'diode' | 'inductor' | 'capacitor' | 'resistor' | 'ground'
  x:      number
  y:      number
  width:  number
  height: number
  label:  string
  value:  string
  status: ComponentStatus
  meta?:  string
}

export type SchematicWire = {
  id:      string
  points:  Array<{ x: number; y: number }>
  label?:  string
  status?: ComponentStatus
}

export type SchematicDefinition = {
  nodes:      SchematicNode[]
  components: SchematicComponent[]
  wires:      SchematicWire[]
}

/** Args passed to every topology schematic generator. */
export type GeneratorArgs = { spec: DesignSpec; result: DesignResult | null }

export const TOPOLOGY_DESCRIPTIONS: Record<string, string> = {
  buck:         'Non-isolated step-down converter. Switch → Inductor → Output.',
  boost:        'Non-isolated step-up converter. Inductor → Switch → Output.',
  'buck-boost': 'Non-isolated inverting converter. Flexible Vin/Vout ratio.',
  flyback:      'Isolated converter derived from buck-boost. Transformer-based.',
  llc:          'Resonant isolated converter. High efficiency at resonant frequency.',
}

export const STATUS_STROKES: Record<ComponentStatus, string> = {
  normal:    '#e5e7eb',
  warning:   '#f59e0b',
  violation: '#ef4444',
}

export const TEXT_COLOR = '#f8fafc'
export const MUTED_TEXT = '#94a3b8'
export const LINE_COLOR = '#cbd5e1'
