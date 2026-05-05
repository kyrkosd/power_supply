import React, { useMemo } from 'react'
import { useDesignStore } from '../../store/design-store'
import styles from './SchematicView.module.css'
import type { DesignSpec, DesignResult } from '../../engine/types'

type ComponentStatus = 'normal' | 'warning' | 'violation'

type SchematicNode = {
  id: string
  x: number
  y: number
}

type SchematicComponent = {
  id: string
  type: 'source' | 'switch' | 'diode' | 'inductor' | 'capacitor' | 'resistor' | 'ground'
  x: number
  y: number
  width: number
  height: number
  label: string
  value: string
  status: ComponentStatus
  meta?: string
}

type SchematicWire = {
  id: string
  points: Array<{ x: number; y: number }>
  label?: string
  status?: ComponentStatus
}

type SchematicDefinition = {
  nodes: SchematicNode[]
  components: SchematicComponent[]
  wires: SchematicWire[]
}

const TOPOLOGY_DESCRIPTIONS: Record<string, string> = {
  buck: 'Non-isolated step-down converter. Switch → Inductor → Output.',
  boost: 'Non-isolated step-up converter. Inductor → Switch → Output.',
  'buck-boost': 'Non-isolated inverting converter. Flexible Vin/Vout ratio.',
  flyback: 'Isolated converter derived from buck-boost. Transformer-based.',
  llc: 'Resonant isolated converter. High efficiency at resonant frequency.',
}

const STATUS_STROKES: Record<ComponentStatus, string> = {
  normal: '#e5e7eb',
  warning: '#f59e0b',
  violation: '#ef4444',
}

const TEXT_COLOR = '#f8fafc'
const MUTED_TEXT = '#94a3b8'
const LINE_COLOR = '#cbd5e1'

function formatU(value: number, decimals: number, unit: string) {
  return `${value.toFixed(decimals)} ${unit}`
}

function inductorStatusFromResult(result: DesignResult | null): ComponentStatus {
  const sat = result?.saturation_check
  if (!sat) return 'normal'
  if (sat.is_saturated) return 'violation'
  if (sat.margin_pct !== null && sat.margin_pct < 20) return 'warning'
  if (sat.estimated_B_peak > sat.B_sat_material * 0.80) return 'warning'
  return 'normal'
}

function formatResistance(value: number) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1000) return `${(value / 1000).toFixed(1)} kΩ`
  return `${value.toFixed(1)} Ω`
}

function createBuckSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty = result?.dutyCycle ?? Math.min(Math.max(spec.vout / spec.vinMax, 0.01), 0.99)
  const inductanceLabel = result
    ? `${formatU(result.inductance * 1e6, 2, 'µH')}`
    : '—'
  const capacitanceLabel = result
    ? `${formatU(result.capacitance * 1e6, 1, 'µF')}`
    : '—'
  const outputEsr = result
    ? Math.max(0.0001, spec.voutRippleMax / Math.max((Math.abs((spec.vout * (1 - duty)) / (result.inductance * spec.fsw)) / (2 * Math.sqrt(3))), 1e-6))
    : NaN
  const esrLabel = Number.isFinite(outputEsr)
    ? `${(outputEsr * 1000).toFixed(1)} mΩ ESR`
    : 'ESR —'
  const loadResistance = spec.iout > 0 ? spec.vout / spec.iout : NaN
  const inductorStatus: ComponentStatus = inductorStatusFromResult(result)
  const switchStatus: ComponentStatus = duty >= 0.9 || duty <= 0.1 ? 'violation' : duty >= 0.82 || duty <= 0.15 ? 'warning' : 'normal'
  const outputStatus: ComponentStatus = outputEsr > 0.1 ? 'warning' : 'normal'

  const nodes: SchematicNode[] = [
    { id: 'vin', x: 92, y: 102 },
    { id: 'switch', x: 250, y: 102 },
    { id: 'diode', x: 250, y: 220 },
    { id: 'inductor', x: 430, y: 102 },
    { id: 'vout', x: 620, y: 102 },
    { id: 'gndLeft', x: 92, y: 280 },
    { id: 'gndRight', x: 620, y: 280 },
  ]

  const components: SchematicComponent[] = [
    {
      id: 'Vin',
      type: 'source',
      x: 50,
      y: 50,
      width: 76,
      height: 104,
      label: 'Vin',
      value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`,
      status: 'normal',
      meta: 'Input source',
    },
    {
      id: 'Cin',
      type: 'capacitor',
      x: 170,
      y: 18,
      width: 40,
      height: 64,
      label: 'Cin',
      value: `${formatU(Math.max(0.01, spec.iout / (spec.fsw * spec.vinMax * 0.1)) * 1e6, 1, 'µF')}`,
      status: 'normal',
    },
    {
      id: 'Q1',
      type: 'switch',
      x: 200,
      y: 58,
      width: 92,
      height: 112,
      label: 'Q1',
      value: `D=${duty.toFixed(2)}`,
      status: switchStatus,
      meta: 'High-side MOSFET',
    },
    {
      id: 'D1',
      type: 'diode',
      x: 200,
      y: 186,
      width: 92,
      height: 72,
      label: 'D1',
      value: 'Freewheel diode',
      status: 'normal',
    },
    {
      id: 'L',
      type: 'inductor',
      x: 390,
      y: 74,
      width: 80,
      height: 116,
      label: 'L',
      value: inductanceLabel,
      status: inductorStatus,
    },
    {
      id: 'Cout',
      type: 'capacitor',
      x: 560,
      y: 40,
      width: 78,
      height: 106,
      label: 'Cout',
      value: `${capacitanceLabel} / ${esrLabel}`,
      status: outputStatus,
    },
    {
      id: 'Rload',
      type: 'resistor',
      x: 700,
      y: 88,
      width: 80,
      height: 80,
      label: 'Rload',
      value: formatResistance(loadResistance),
      status: 'normal',
    },
    {
      id: 'GroundLeft',
      type: 'ground',
      x: 80,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
    {
      id: 'GroundRight',
      type: 'ground',
      x: 608,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
  ]

  const wires: SchematicWire[] = [
    { id: 'wire1', points: [nodes[0], { x: 158, y: 102 }, nodes[1]] },
    { id: 'wire2', points: [nodes[1], { x: 350, y: 102 }, nodes[3]] },
    { id: 'wire3', points: [nodes[1], { x: 250, y: 166 }, nodes[2]] },
    { id: 'wire4', points: [nodes[2], { x: 250, y: 266 }, nodes[5]] },
    { id: 'wire5', points: [nodes[3], { x: 510, y: 102 }, nodes[4]] },
    { id: 'wire6', points: [nodes[4], { x: 700, y: 102 }] },
    { id: 'wire7', points: [nodes[4], { x: 620, y: 210 }, nodes[6]] },
    { id: 'wire8', points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 92, y: 132 }] },
    { id: 'wire9', points: [{ x: 130, y: 18 }, { x: 130, y: 34 }] },
  ]

  return { nodes, components, wires }
}

function createBoostSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty = result?.dutyCycle ?? Math.min(Math.max(1 - spec.vinMin / spec.vout, 0.01), 0.99)
  const inductanceLabel = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}` : '—'
  const capacitanceLabel = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'
  const outputEsr = result ? Math.max(0.0001, Math.min(spec.voutRippleMax, 0.1) / Math.max(result.peakCurrent, 1e-6)) : NaN
  const esrLabel = Number.isFinite(outputEsr) ? `${(outputEsr * 1000).toFixed(1)} mΩ ESR` : 'ESR —'
  const loadResistance = spec.iout > 0 ? spec.vout / spec.iout : NaN
  const switchStatus: ComponentStatus = duty >= 0.9 || duty <= 0.1 ? 'violation' : duty >= 0.82 || duty <= 0.15 ? 'warning' : 'normal'
  const inductorStatus: ComponentStatus = inductorStatusFromResult(result)
  const outputStatus: ComponentStatus = outputEsr > 0.1 ? 'warning' : 'normal'

  const nodes: SchematicNode[] = [
    { id: 'vin', x: 90, y: 102 },
    { id: 'inductor', x: 210, y: 102 },
    { id: 'switch', x: 370, y: 102 },
    { id: 'diode', x: 370, y: 220 },
    { id: 'vout', x: 540, y: 102 },
    { id: 'gndLeft', x: 90, y: 280 },
    { id: 'gndRight', x: 540, y: 280 },
  ]

  const components: SchematicComponent[] = [
    {
      id: 'Vin',
      type: 'source',
      x: 50,
      y: 50,
      width: 76,
      height: 104,
      label: 'Vin',
      value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`,
      status: 'normal',
    },
    {
      id: 'L',
      type: 'inductor',
      x: 190,
      y: 74,
      width: 80,
      height: 116,
      label: 'L',
      value: inductanceLabel,
      status: inductorStatus,
    },
    {
      id: 'Q1',
      type: 'switch',
      x: 340,
      y: 58,
      width: 92,
      height: 112,
      label: 'Q1',
      value: `D=${duty.toFixed(2)}`,
      status: switchStatus,
    },
    {
      id: 'D1',
      type: 'diode',
      x: 340,
      y: 186,
      width: 92,
      height: 72,
      label: 'D1',
      value: 'Boost diode',
      status: 'normal',
    },
    {
      id: 'Cout',
      type: 'capacitor',
      x: 520,
      y: 40,
      width: 78,
      height: 106,
      label: 'Cout',
      value: `${capacitanceLabel} / ${esrLabel}`,
      status: outputStatus,
    },
    {
      id: 'Cin',
      type: 'capacitor',
      x: 150,
      y: 18,
      width: 40,
      height: 64,
      label: 'Cin',
      value: `${formatU(Math.max(0.01, spec.iout / (spec.fsw * spec.vinMax * 0.1)) * 1e6, 1, 'µF')}`,
      status: 'normal',
    },
    {
      id: 'Rload',
      type: 'resistor',
      x: 680,
      y: 88,
      width: 80,
      height: 80,
      label: 'Rload',
      value: formatResistance(loadResistance),
      status: 'normal',
    },
    {
      id: 'GroundLeft',
      type: 'ground',
      x: 80,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
    {
      id: 'GroundRight',
      type: 'ground',
      x: 528,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
  ]

  const wires: SchematicWire[] = [
    { id: 'wire1', points: [nodes[0], { x: 170, y: 102 }, nodes[1]] },
    { id: 'wire2', points: [nodes[1], { x: 330, y: 102 }, nodes[2]] },
    { id: 'wire3', points: [nodes[2], { x: 330, y: 166 }, nodes[3]] },
    { id: 'wire4', points: [nodes[3], { x: 370, y: 266 }, nodes[6]] },
    { id: 'wire5', points: [nodes[3], { x: 450, y: 220 }, nodes[4]] },
    { id: 'wire6', points: [nodes[4], { x: 760, y: 102 }] },
    { id: 'wire7', points: [nodes[4], { x: 540, y: 210 }, nodes[6]] },
    { id: 'wire8', points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 90, y: 132 }] },
    { id: 'wire9', points: [{ x: 330, y: 58 }, { x: 330, y: 18 }, { x: 130, y: 18 }] },
  ]

  return { nodes, components, wires }
}

function createBuckBoostSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty = result?.dutyCycle ?? Math.min(Math.max(Math.abs(spec.vout) / (spec.vinMin + Math.abs(spec.vout)), 0.01), 0.99)
  const inductanceLabel = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}` : '—'
  const capacitanceLabel = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'
  const outputEsr = result ? Math.max(0.0001, Math.min(spec.voutRippleMax, 0.1) / Math.max(result.peakCurrent, 1e-6)) : NaN
  const esrLabel = Number.isFinite(outputEsr) ? `${(outputEsr * 1000).toFixed(1)} mΩ ESR` : 'ESR —'
  const loadResistance = spec.iout > 0 ? Math.abs(spec.vout) / spec.iout : NaN
  const switchStatus: ComponentStatus = duty >= 0.9 || duty <= 0.1 ? 'violation' : duty >= 0.82 || duty <= 0.15 ? 'warning' : 'normal'
  const inductorStatus: ComponentStatus = inductorStatusFromResult(result)
  const outputStatus: ComponentStatus = outputEsr > 0.1 ? 'warning' : 'normal'

  const nodes: SchematicNode[] = [
    { id: 'vin', x: 90, y: 102 },
    { id: 'switch', x: 230, y: 102 },
    { id: 'node', x: 360, y: 102 },
    { id: 'inductor', x: 490, y: 102 },
    { id: 'vout', x: 650, y: 102 },
    { id: 'gndLeft', x: 90, y: 280 },
    { id: 'gndRight', x: 650, y: 280 },
  ]

  const components: SchematicComponent[] = [
    {
      id: 'Vin',
      type: 'source',
      x: 50,
      y: 50,
      width: 76,
      height: 104,
      label: 'Vin',
      value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`,
      status: 'normal',
    },
    {
      id: 'Q1',
      type: 'switch',
      x: 210,
      y: 58,
      width: 92,
      height: 112,
      label: 'Q1',
      value: `D=${duty.toFixed(2)}`,
      status: switchStatus,
    },
    {
      id: 'L',
      type: 'inductor',
      x: 430,
      y: 74,
      width: 80,
      height: 116,
      label: 'L',
      value: inductanceLabel,
      status: inductorStatus,
    },
    {
      id: 'D1',
      type: 'diode',
      x: 330,
      y: 186,
      width: 92,
      height: 72,
      label: 'D1',
      value: 'Output diode',
      status: 'normal',
    },
    {
      id: 'Cout',
      type: 'capacitor',
      x: 610,
      y: 40,
      width: 78,
      height: 106,
      label: 'Cout',
      value: `${capacitanceLabel} / ${esrLabel}`,
      status: outputStatus,
    },
    {
      id: 'Cin',
      type: 'capacitor',
      x: 150,
      y: 18,
      width: 40,
      height: 64,
      label: 'Cin',
      value: `${formatU(Math.max(0.01, spec.iout / (spec.fsw * spec.vinMin * 0.1)) * 1e6, 1, 'µF')}`,
      status: 'normal',
    },
    {
      id: 'Rload',
      type: 'resistor',
      x: 710,
      y: 88,
      width: 80,
      height: 80,
      label: 'Rload',
      value: formatResistance(loadResistance),
      status: 'normal',
    },
    {
      id: 'GroundLeft',
      type: 'ground',
      x: 80,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
    {
      id: 'GroundRight',
      type: 'ground',
      x: 628,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
  ]

  const wires: SchematicWire[] = [
    { id: 'wire1', points: [nodes[0], { x: 180, y: 102 }, nodes[1]] },
    { id: 'wire2', points: [nodes[1], { x: 330, y: 102 }, nodes[2]] },
    { id: 'wire3', points: [nodes[2], { x: 430, y: 102 }, nodes[3]] },
    { id: 'wire4', points: [nodes[3], { x: 610, y: 102 }, nodes[4]] },
    { id: 'wire5', points: [nodes[2], { x: 330, y: 166 }, nodes[3]] },
    { id: 'wire6', points: [nodes[2], { x: 330, y: 266 }, nodes[5]] },
    { id: 'wire7', points: [nodes[4], { x: 650, y: 210 }, nodes[6]] },
    { id: 'wire8', points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 90, y: 132 }] },
    { id: 'wire9', points: [{ x: 230, y: 58 }, { x: 230, y: 18 }, { x: 130, y: 18 }] },
  ]

  return { nodes, components, wires }
}

function createFlybackSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty = result?.dutyCycle ?? Math.min(Math.max(spec.vout / (spec.vinMin + spec.vout), 0.01), 0.45)
  const turnsRatio = result?.turnsRatio ?? (spec.vinMin * duty) / spec.vout
  const inductanceLabel = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}` : '—'
  const capacitanceLabel = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'
  const coreLabel = result?.coreType ?? '—'
  const primaryTurns = result?.primaryTurns ?? 0
  const secondaryTurns = result?.secondaryTurns ?? 0
  const clampVoltage = result?.clampVoltage ?? 0
  const secondaries = spec.secondary_outputs ?? []

  const switchStatus: ComponentStatus = duty >= 0.45 ? 'violation' : duty >= 0.4 ? 'warning' : 'normal'
  const transformerStatus: ComponentStatus = result?.warnings.some(w => w.includes('core')) ? 'warning' : 'normal'

  // Transformer label shows all winding ratios when multi-output is active
  const turnsLabel = secondaries.length > 0
    ? `${primaryTurns}:${secondaryTurns}+${secondaries.length}`
    : `${coreLabel} ${primaryTurns}:${secondaryTurns}`

  const nodes: SchematicNode[] = [
    { id: 'vin',      x: 90,  y: 102 },
    { id: 'switch',   x: 230, y: 102 },
    { id: 'transformer', x: 380, y: 102 },
    { id: 'diode',    x: 530, y: 102 },
    { id: 'vout',     x: 680, y: 102 },
    { id: 'gndLeft',  x: 90,  y: 280 },
    { id: 'gndRight', x: 680, y: 280 },
  ]

  const components: SchematicComponent[] = [
    {
      id: 'Vin', type: 'source', x: 50, y: 50, width: 76, height: 104,
      label: 'Vin', value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`, status: 'normal',
    },
    {
      id: 'Cin', type: 'capacitor', x: 150, y: 18, width: 40, height: 64,
      label: 'Cin', value: `${formatU(Math.max(0.01, spec.iout / (spec.fsw * spec.vinMin * 0.1)) * 1e6, 1, 'µF')}`,
      status: 'normal',
    },
    {
      id: 'Q1', type: 'switch', x: 190, y: 58, width: 92, height: 112,
      label: 'Q1', value: `D=${duty.toFixed(2)}`, status: switchStatus, meta: 'Primary MOSFET',
    },
    {
      id: 'T1', type: 'inductor', x: 340, y: 50, width: 80, height: 140,
      label: 'T1', value: turnsLabel, status: transformerStatus,
      meta: `Lm=${inductanceLabel}, N=${turnsRatio.toFixed(1)}`,
    },
    {
      id: 'RCD', type: 'resistor', x: 300, y: 10, width: 60, height: 40,
      label: 'RCD', value: `Vclamp=${clampVoltage.toFixed(0)}V`, status: 'normal', meta: 'Clamp circuit',
    },
    // Primary regulated output: diode + cap
    {
      id: 'D1', type: 'diode', x: 490, y: 58, width: 92, height: 112,
      label: 'D1', value: 'Regulated out', status: 'normal',
    },
    {
      id: 'Cout', type: 'capacitor', x: 640, y: 40, width: 78, height: 106,
      label: 'Cout', value: capacitanceLabel, status: 'normal',
    },
    { id: 'GroundLeft',  type: 'ground', x: 80,  y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' },
    { id: 'GroundRight', type: 'ground', x: 668, y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' },
  ]

  const wires: SchematicWire[] = [
    { id: 'wire1', points: [nodes[0], { x: 180, y: 102 }, nodes[1]] },
    { id: 'wire2', points: [nodes[1], { x: 340, y: 102 }, nodes[2]] },
    { id: 'wire3', points: [nodes[2], { x: 490, y: 102 }, nodes[3]] },
    { id: 'wire4', points: [nodes[3], { x: 640, y: 102 }, nodes[4]] },
    { id: 'wire5', points: [nodes[2], { x: 380, y: 190 }, nodes[5]] },
    { id: 'wire6', points: [nodes[4], { x: 680, y: 190 }, nodes[6]] },
    { id: 'wire7', points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 90, y: 132 }] },
    { id: 'wire8', points: [{ x: 230, y: 58 }, { x: 230, y: 18 }, { x: 130, y: 18 }] },
    { id: 'wire9', points: [{ x: 380, y: 50 }, { x: 320, y: 50 }, { x: 320, y: 10 }] },
  ]

  // Additional secondary winding circuits — stacked below the primary at +90px each
  secondaries.forEach((s, i) => {
    const yOff = 320 + i * 90
    const secResult = result?.secondaryOutputResults?.[i]
    const capLabel  = secResult ? `${formatU(secResult.capacitance * 1e6, 1, 'µF')}` : '—'

    // Tap wire from transformer secondary side down to this output's y-level
    wires.push({
      id: `wireSec${i}tap`,
      points: [{ x: 420, y: 102 + i * 90 + 80 }, { x: 490, y: 102 + i * 90 + 80 }],
    })

    components.push(
      {
        id: `D${i + 2}`, type: 'diode', x: 490, y: yOff - 32, width: 92, height: 72,
        label: `D${i + 2}`, value: `Out ${i + 2}: ${s.vout.toFixed(1)} V`, status: 'normal',
      },
      {
        id: `Cout${i + 2}`, type: 'capacitor', x: 640, y: yOff - 50, width: 60, height: 80,
        label: `Cout${i + 2}`, value: capLabel, status: 'normal',
      },
      {
        id: `GND${i + 2}`, type: 'ground', x: 668, y: yOff + 44, width: 0, height: 0,
        label: '', value: '', status: 'normal',
      },
    )

    nodes.push({ id: `sec${i}out`, x: 668, y: yOff })

    wires.push(
      { id: `wireSec${i}a`, points: [{ x: 582, y: yOff }, { x: 640, y: yOff }] },
      { id: `wireSec${i}b`, points: [{ x: 668, y: yOff }, { x: 668, y: yOff + 44 }] },
    )
  })

  return { nodes, components, wires }
}

function createForwardSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty = result?.dutyCycle ?? Math.min(Math.max(spec.vout / spec.vinMin, 0.01), 0.45)
  const turnsRatio = result?.turnsRatio ?? (spec.vinMin * duty) / spec.vout
  const inductanceLabel = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}` : '—'
  const capacitanceLabel = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'
  const coreLabel = result?.coreType ?? '—'
  const primaryTurns = result?.primaryTurns ?? 0
  const secondaryTurns = result?.secondaryTurns ?? 0
  const resetVoltage = result?.resetVoltage ?? 0

  const switchStatus: ComponentStatus = duty >= 0.45 ? 'violation' : duty >= 0.4 ? 'warning' : 'normal'
  const transformerStatus: ComponentStatus = result?.warnings.some(w => w.includes('core')) ? 'warning' : 'normal'

  const nodes: SchematicNode[] = [
    { id: 'vin', x: 90, y: 102 },
    { id: 'switch', x: 230, y: 102 },
    { id: 'transformer', x: 380, y: 102 },
    { id: 'diode1', x: 530, y: 102 },
    { id: 'inductor', x: 650, y: 102 },
    { id: 'diode2', x: 530, y: 220 },
    { id: 'vout', x: 780, y: 102 },
    { id: 'gndLeft', x: 90, y: 280 },
    { id: 'gndRight', x: 780, y: 280 },
  ]

  const components: SchematicComponent[] = [
    {
      id: 'Vin',
      type: 'source',
      x: 50,
      y: 50,
      width: 76,
      height: 104,
      label: 'Vin',
      value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`,
      status: 'normal',
    },
    {
      id: 'Cin',
      type: 'capacitor',
      x: 150,
      y: 18,
      width: 40,
      height: 64,
      label: 'Cin',
      value: `${formatU(Math.max(0.01, spec.iout / (spec.fsw * spec.vinMin * 0.1)) * 1e6, 1, 'µF')}`,
      status: 'normal',
    },
    {
      id: 'Q1',
      type: 'switch',
      x: 190,
      y: 58,
      width: 92,
      height: 112,
      label: 'Q1',
      value: `D=${duty.toFixed(2)}`,
      status: switchStatus,
      meta: 'Primary MOSFET',
    },
    {
      id: 'T1',
      type: 'inductor',
      x: 340,
      y: 50,
      width: 80,
      height: 140,
      label: 'T1',
      value: `${coreLabel} ${primaryTurns}:${secondaryTurns}`,
      status: transformerStatus,
      meta: `N=${turnsRatio.toFixed(1)}, Vreset=${resetVoltage}V`,
    },
    {
      id: 'D1',
      type: 'diode',
      x: 490,
      y: 58,
      width: 92,
      height: 112,
      label: 'D1',
      value: 'Forward rectifier',
      status: 'normal',
    },
    {
      id: 'Lo',
      type: 'inductor',
      x: 600,
      y: 74,
      width: 80,
      height: 116,
      label: 'Lo',
      value: inductanceLabel,
      status: 'normal',
      meta: 'Output inductor',
    },
    {
      id: 'D2',
      type: 'diode',
      x: 490,
      y: 186,
      width: 92,
      height: 72,
      label: 'D2',
      value: 'Freewheel diode',
      status: 'normal',
    },
    {
      id: 'Cout',
      type: 'capacitor',
      x: 740,
      y: 40,
      width: 78,
      height: 106,
      label: 'Cout',
      value: capacitanceLabel,
      status: 'normal',
    },
    {
      id: 'GroundLeft',
      type: 'ground',
      x: 80,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
    {
      id: 'GroundRight',
      type: 'ground',
      x: 768,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
  ]

  const wires: SchematicWire[] = [
    { id: 'wire1', points: [nodes[0], { x: 180, y: 102 }, nodes[1]] },
    { id: 'wire2', points: [nodes[1], { x: 340, y: 102 }, nodes[2]] },
    { id: 'wire3', points: [nodes[2], { x: 490, y: 102 }, nodes[3]] },
    { id: 'wire4', points: [nodes[3], { x: 600, y: 102 }, nodes[4]] },
    { id: 'wire5', points: [nodes[4], { x: 740, y: 102 }, nodes[6]] },
    { id: 'wire6', points: [nodes[3], { x: 530, y: 166 }, nodes[5]] },
    { id: 'wire7', points: [nodes[5], { x: 600, y: 220 }, { x: 600, y: 190 }, nodes[4]] },
    { id: 'wire8', points: [nodes[6], { x: 780, y: 190 }, nodes[7]] },
    { id: 'wire9', points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 90, y: 132 }] },
    { id: 'wire10', points: [{ x: 230, y: 58 }, { x: 230, y: 18 }, { x: 130, y: 18 }] },
  ]

  return { nodes, components, wires }
}

function createSepicSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty = result?.dutyCycle ?? Math.min(Math.max(spec.vout / (spec.vinMin + spec.vout), 0.05), 0.95)
  const inputInductanceLabel = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}` : '—'
  const outputInductanceLabel = result?.outputInductance ? `${formatU(result.outputInductance * 1e6, 2, 'µH')}` : '—'
  const couplingCapLabel = result?.couplingCapacitance ? `${formatU(result.couplingCapacitance * 1e6, 1, 'µF')}` : '—'
  const outputCapLabel = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'

  const switchStatus: ComponentStatus = duty >= 0.8 || duty <= 0.2 ? 'warning' : 'normal'

  const nodes: SchematicNode[] = [
    { id: 'vin', x: 90, y: 102 },
    { id: 'l1', x: 230, y: 102 },
    { id: 'cc', x: 370, y: 102 },
    { id: 'l2', x: 370, y: 220 },
    { id: 'switch', x: 510, y: 220 },
    { id: 'diode', x: 510, y: 102 },
    { id: 'vout', x: 650, y: 102 },
    { id: 'gndLeft', x: 90, y: 280 },
    { id: 'gndRight', x: 650, y: 280 },
  ]

  const components: SchematicComponent[] = [
    {
      id: 'Vin',
      type: 'source',
      x: 50,
      y: 50,
      width: 76,
      height: 104,
      label: 'Vin',
      value: `${spec.vinMin.toFixed(1)}–${spec.vinMax.toFixed(1)} V`,
      status: 'normal',
    },
    {
      id: 'L1',
      type: 'inductor',
      x: 170,
      y: 74,
      width: 80,
      height: 116,
      label: 'L1',
      value: inputInductanceLabel,
      status: 'normal',
      meta: 'Input inductor',
    },
    {
      id: 'Cc',
      type: 'capacitor',
      x: 320,
      y: 40,
      width: 78,
      height: 106,
      label: 'Cc',
      value: couplingCapLabel,
      status: 'normal',
      meta: 'Coupling capacitor',
    },
    {
      id: 'L2',
      type: 'inductor',
      x: 320,
      y: 186,
      width: 80,
      height: 116,
      label: 'L2',
      value: outputInductanceLabel,
      status: 'normal',
      meta: 'Output inductor',
    },
    {
      id: 'Q1',
      type: 'switch',
      x: 470,
      y: 186,
      width: 92,
      height: 112,
      label: 'Q1',
      value: `D=${duty.toFixed(2)}`,
      status: switchStatus,
      meta: 'MOSFET',
    },
    {
      id: 'D1',
      type: 'diode',
      x: 470,
      y: 58,
      width: 92,
      height: 112,
      label: 'D1',
      value: 'Output diode',
      status: 'normal',
    },
    {
      id: 'Cout',
      type: 'capacitor',
      x: 610,
      y: 40,
      width: 78,
      height: 106,
      label: 'Cout',
      value: outputCapLabel,
      status: 'normal',
    },
    {
      id: 'GroundLeft',
      type: 'ground',
      x: 80,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
    {
      id: 'GroundRight',
      type: 'ground',
      x: 638,
      y: 260,
      width: 0,
      height: 0,
      label: '',
      value: '',
      status: 'normal',
    },
  ]

  const wires: SchematicWire[] = [
    { id: 'wire1', points: [nodes[0], { x: 170, y: 102 }, nodes[1]] },
    { id: 'wire2', points: [nodes[1], { x: 320, y: 102 }, nodes[2]] },
    { id: 'wire3', points: [nodes[2], { x: 470, y: 102 }, nodes[5]] },
    { id: 'wire4', points: [nodes[5], { x: 610, y: 102 }, nodes[6]] },
    { id: 'wire5', points: [nodes[2], { x: 370, y: 146 }, nodes[3]] },
    { id: 'wire6', points: [nodes[3], { x: 470, y: 220 }, nodes[4]] },
    { id: 'wire7', points: [nodes[4], { x: 510, y: 280 }, nodes[7]] },
    { id: 'wire8', points: [nodes[6], { x: 650, y: 190 }, nodes[8]] },
    { id: 'wire9', points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 90, y: 132 }] },
    { id: 'wire10', points: [{ x: 230, y: 58 }, { x: 230, y: 18 }, { x: 130, y: 18 }] },
  ]

  return { nodes, components, wires }
}

function renderComponent(component: SchematicComponent) {
  const stroke = STATUS_STROKES[component.status]
  const labelColor = TEXT_COLOR
  const valueColor = MUTED_TEXT

  const commonProps = {
    stroke,
    strokeWidth: 2,
    fill: 'none' as const,
    shapeRendering: 'crispEdges' as const,
  }

  switch (component.type) {
    case 'source':
      return (
        <g key={component.id}>
          <rect
            x={component.x}
            y={component.y}
            width={component.width}
            height={component.height}
            rx={12}
            {...commonProps}
          />
          <line x1={component.x + 24} y1={component.y + 18} x2={component.x + 24} y2={component.y + 50} stroke={stroke} strokeWidth={2} />
          <line x1={component.x + 50} y1={component.y + 34} x2={component.x + 50} y2={component.y + 74} stroke={stroke} strokeWidth={2} />
          <text x={component.x + component.width / 2} y={component.y - 6} fill={labelColor} fontSize={12} fontWeight={700} textAnchor="middle">{component.label}</text>
          <text x={component.x + component.width / 2} y={component.y + component.height + 16} fill={valueColor} fontSize={11} textAnchor="middle">{component.value}</text>
          {component.meta && <title>{component.meta}</title>}
        </g>
      )
    case 'switch':
      return (
        <g key={component.id}>
          <rect x={component.x} y={component.y} width={component.width} height={component.height} rx={12} {...commonProps} />
          <line x1={component.x + component.width / 2} y1={component.y + 18} x2={component.x + component.width / 2} y2={component.y + component.height - 18} stroke={stroke} strokeWidth={2} />
          <polyline points={`${component.x + 18},${component.y + 38} ${component.x + component.width - 18},${component.y + 38}`} fill="none" stroke={stroke} strokeWidth={2} />
          <line x1={component.x + 18} y1={component.y + 84} x2={component.x + component.width - 18} y2={component.y + 84} stroke={stroke} strokeWidth={2} />
          <line x1={component.x + component.width + 6} y1={component.y + 28} x2={component.x + component.width + 24} y2={component.y + 28} stroke={stroke} strokeWidth={2} />
          <line x1={component.x + component.width + 6} y1={component.y + 86} x2={component.x + component.width + 24} y2={component.y + 86} stroke={stroke} strokeWidth={2} />
          <path d={`M ${component.x + component.width + 24} ${component.y + 28} L ${component.x + component.width + 24} ${component.y + 86}`} stroke={stroke} strokeWidth={2} />
          <path d={`M ${component.x + component.width + 18} ${component.y + 46} L ${component.x + component.width + 24} ${component.y + 28} L ${component.x + component.width + 30} ${component.y + 46}`} fill="none" stroke={stroke} strokeWidth={2} />
          <text x={component.x + component.width / 2} y={component.y - 6} fill={labelColor} fontSize={12} fontWeight={700} textAnchor="middle">{component.label}</text>
          <text x={component.x + component.width / 2} y={component.y + component.height + 16} fill={valueColor} fontSize={11} textAnchor="middle">{component.value}</text>
          {component.meta && <title>{component.meta}</title>}
        </g>
      )
    case 'diode':
      return (
        <g key={component.id}>
          <path d={`M ${component.x + 16} ${component.y + component.height / 2} L ${component.x + component.width - 16} ${component.y + 20} L ${component.x + component.width - 16} ${component.y + component.height - 20} Z`} fill="none" stroke={stroke} strokeWidth={2} />
          <line x1={component.x + component.width - 16} y1={component.y + 20} x2={component.x + component.width - 16} y2={component.y + component.height - 20} stroke={stroke} strokeWidth={2} />
          <line x1={component.x + 14} y1={component.y + 12} x2={component.x + 14} y2={component.y + component.height - 12} stroke={stroke} strokeWidth={2} />
          <text x={component.x + component.width / 2} y={component.y - 6} fill={labelColor} fontSize={12} fontWeight={700} textAnchor="middle">{component.label}</text>
          <text x={component.x + component.width / 2} y={component.y + component.height + 16} fill={valueColor} fontSize={11} textAnchor="middle">{component.value}</text>
          {component.meta && <title>{component.meta}</title>}
        </g>
      )
    case 'inductor':
      return (
        <g key={component.id}>
          <path d={`M ${component.x} ${component.y + component.height / 2} h 8 q 6 -28 16 0 q 6 -28 16 0 q 6 -28 16 0 q 6 -28 16 0 h 8`} fill="none" stroke={stroke} strokeWidth={2} />
          <text x={component.x + component.width / 2} y={component.y - 6} fill={labelColor} fontSize={12} fontWeight={700} textAnchor="middle">{component.label}</text>
          <text x={component.x + component.width / 2} y={component.y + component.height + 16} fill={valueColor} fontSize={11} textAnchor="middle">{component.value}</text>
          {component.meta && <title>{component.meta}</title>}
        </g>
      )
    case 'capacitor':
      return (
        <g key={component.id}>
          <line x1={component.x + 14} y1={component.y + 12} x2={component.x + 14} y2={component.y + component.height - 12} stroke={stroke} strokeWidth={2} />
          <line x1={component.x + component.width - 14} y1={component.y + 12} x2={component.x + component.width - 14} y2={component.y + component.height - 12} stroke={stroke} strokeWidth={2} />
          <line x1={component.x + 14} y1={component.y + component.height / 2} x2={component.x + component.width - 14} y2={component.y + component.height / 2} stroke={stroke} strokeWidth={2} />
          <text x={component.x + component.width / 2} y={component.y - 6} fill={labelColor} fontSize={12} fontWeight={700} textAnchor="middle">{component.label}</text>
          <text x={component.x + component.width / 2} y={component.y + component.height + 16} fill={valueColor} fontSize={11} textAnchor="middle">{component.value}</text>
          {component.meta && <title>{component.meta}</title>}
        </g>
      )
    case 'resistor':
      return (
        <g key={component.id}>
          <polyline
            points={`${component.x} ${component.y + component.height / 2} ${component.x + 10} ${component.y + 18} ${component.x + 24} ${component.y + component.height - 18} ${component.x + 38} ${component.y + 18} ${component.x + 52} ${component.y + component.height - 18} ${component.x + 66} ${component.y + 18} ${component.x + component.width} ${component.y + component.height / 2}`}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
          />
          <text x={component.x + component.width / 2} y={component.y - 6} fill={labelColor} fontSize={12} fontWeight={700} textAnchor="middle">{component.label}</text>
          <text x={component.x + component.width / 2} y={component.y + component.height + 16} fill={valueColor} fontSize={11} textAnchor="middle">{component.value}</text>
          {component.meta && <title>{component.meta}</title>}
        </g>
      )
    case 'ground':
      return (
        <g key={component.id}>
          <line x1={component.x} y1={component.y} x2={component.x} y2={component.y + 14} stroke={stroke} strokeWidth={2} />
          <line x1={component.x - 14} y1={component.y + 14} x2={component.x + 14} y2={component.y + 14} stroke={stroke} strokeWidth={2} />
          <line x1={component.x - 10} y1={component.y + 18} x2={component.x + 10} y2={component.y + 18} stroke={stroke} strokeWidth={2} />
          <line x1={component.x - 6} y1={component.y + 22} x2={component.x + 6} y2={component.y + 22} stroke={stroke} strokeWidth={2} />
        </g>
      )
    default:
      return null
  }
}

function renderWire(wire: SchematicWire) {
  const points = wire.points.map((point) => `${point.x},${point.y}`).join(' ')
  const stroke = wire.status ? STATUS_STROKES[wire.status] : LINE_COLOR
  return (
    <polyline
      key={wire.id}
      points={points}
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function SchematicRenderer({ definition, viewBox = '0 0 860 320' }: { definition: SchematicDefinition; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className={styles.diagram} preserveAspectRatio="xMidYMid meet" data-export-id="schematic">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
        </marker>
      </defs>

      <g>
        {definition.wires.map(renderWire)}
        <path
          d="M 102 40 L 760 40"
          stroke="#60a5fa"
          strokeWidth={2}
          fill="none"
          markerEnd="url(#arrow)"
        />
        <text x={430} y={30} fill="#60a5fa" fontSize={12} fontWeight={600} textAnchor="middle">Vin → Vout</text>
      </g>

      {definition.components.map(renderComponent)}

      {definition.nodes.map((node) => (
        <circle key={node.id} cx={node.x} cy={node.y} r={2} fill={LINE_COLOR} />
      ))}
    </svg>
  )
}

export function SchematicView(): React.ReactElement {
  const topology = useDesignStore((state) => state.topology)
  const spec = useDesignStore((state) => state.spec)
  const result = useDesignStore((state) => state.result)

  const { schematic, viewBox } = useMemo(() => {
    if (topology === 'buck')       return { schematic: createBuckSchematic(spec, result),      viewBox: '0 0 860 320' }
    if (topology === 'boost')      return { schematic: createBoostSchematic(spec, result),     viewBox: '0 0 860 320' }
    if (topology === 'buck-boost') return { schematic: createBuckBoostSchematic(spec, result), viewBox: '0 0 860 320' }
    if (topology === 'forward')    return { schematic: createForwardSchematic(spec, result),   viewBox: '0 0 860 320' }
    if (topology === 'sepic')      return { schematic: createSepicSchematic(spec, result),     viewBox: '0 0 860 320' }
    if (topology === 'flyback') {
      const numSec = spec.secondary_outputs?.length ?? 0
      const height = 320 + numSec * 90
      return { schematic: createFlybackSchematic(spec, result), viewBox: `0 0 860 ${height}` }
    }
    return { schematic: createBuckSchematic(spec, result), viewBox: '0 0 860 320' }
  }, [topology, spec, result])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Schematic — {topology.toUpperCase()}</span>
        <span className={styles.badge}>{topology}</span>
      </div>
      <div className={styles.diagramWrapper}>
        <SchematicRenderer definition={schematic} viewBox={viewBox} />
      </div>
      <div className={styles.description}>
        {TOPOLOGY_DESCRIPTIONS[topology] ?? 'Circuit schematic for the selected topology.'}
      </div>
    </div>
  )
}
