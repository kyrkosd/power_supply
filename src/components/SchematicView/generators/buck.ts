import type { DesignSpec, DesignResult } from '../../../engine/types'
import type { SchematicDefinition, SchematicNode, SchematicWire } from '../schematic-types'
import { formatU, formatResistance, inductorStatusFromResult, switchDutyStatus, cinValueLabel } from '../schematic-utils'

/** Ripple cancellation factor K for an N-phase interleaved buck (Erickson §12.3). */
function rippleFactor(N: number, duty: number): number {
  if (N <= 1) return 1
  const ND = N * duty
  const delta = ND - Math.floor(ND)
  if (delta < 1e-6 || delta > 1 - 1e-6) return 0
  return Math.min((delta * (1 - delta)) / (N * duty * (1 - duty)), 1)
}

export function createBuckSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const N        = Math.max(1, Math.min(6, Math.round(spec.phases ?? 1)))
  const syncMode = spec.rectification === 'synchronous'
  const duty     = result?.dutyCycle ?? Math.min(Math.max(spec.vout / spec.vinMax, 0.01), 0.99)
  const K        = rippleFactor(N, duty)

  const inductanceLabel  = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}${N > 1 ? '/ph' : ''}` : '—'
  const capacitanceLabel = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'
  const outputEsr        = result
    ? Math.max(0.0001, spec.voutRippleMax / Math.max(Math.abs((spec.vout * (1 - duty)) / (result.inductance * spec.fsw)) / (2 * Math.sqrt(3)), 1e-6))
    : NaN
  const esrStr     = Number.isFinite(outputEsr) ? `${(outputEsr * 1000).toFixed(1)} mΩ ESR` : 'ESR —'
  const loadR      = spec.iout > 0 ? spec.vout / spec.iout : NaN
  const indStatus  = inductorStatusFromResult(result)
  const swStatus   = switchDutyStatus(duty)
  const outStatus  = outputEsr > 0.1 ? 'warning' as const : 'normal' as const

  const nodes: SchematicNode[] = [
    { id: 'vin',      x: 92,  y: 102 },
    { id: 'switch',   x: 250, y: 102 },
    { id: 'diode',    x: 250, y: 220 },
    { id: 'inductor', x: 430, y: 102 },
    { id: 'vout',     x: 620, y: 102 },
    { id: 'gndLeft',  x: 92,  y: 280 },
    { id: 'gndRight', x: 620, y: 280 },
  ]

  const components = [
    { id: 'Vin',  type: 'source' as const,    x: 50,  y: 50,  width: 76, height: 104, label: 'Vin',  value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`, status: 'normal' as const, meta: 'Input source' },
    { id: 'Cin',  type: 'capacitor' as const, x: 170, y: 18,  width: 40, height: 64,  label: 'Cin',  value: cinValueLabel(spec.iout, spec.fsw, spec.vinMax), status: 'normal' as const },
    { id: 'Q1',   type: 'switch' as const,    x: 200, y: 58,  width: 92, height: 112, label: N > 1 ? `Q1–Q${N}` : 'Q1', value: `D=${duty.toFixed(2)}${N > 1 ? ` ×${N}` : ''}`, status: swStatus, meta: N > 1 ? `${N} high-side MOSFETs interleaved at 360°/${N} = ${(360 / N).toFixed(0)}° phase shift` : 'High-side MOSFET' },
    { id: 'D1',   type: (syncMode ? 'switch' : 'diode') as 'switch' | 'diode', x: 200, y: 186, width: 92, height: 72, label: syncMode ? (N > 1 ? `Q2–Q${N + 1}` : 'Q2') : (N > 1 ? `D1–D${N}` : 'D1'), value: syncMode ? `Rds=8mΩ${N > 1 ? ` ×${N}` : ''}` : (N > 1 ? `Freewheel ×${N}` : 'Freewheel diode'), status: 'normal' as const, meta: syncMode ? 'Low-side sync FET (replaces freewheeling diode)' : undefined },
    { id: 'L',    type: 'inductor' as const,  x: 390, y: 74,  width: 80, height: 116, label: N > 1 ? `L1–L${N}` : 'L', value: inductanceLabel, status: indStatus, meta: N > 1 ? `Per-phase inductance. Ripple cancellation K=${K.toFixed(2)} (0=perfect).` : undefined },
    { id: 'Cout', type: 'capacitor' as const, x: 560, y: 40,  width: 78, height: 106, label: 'Cout', value: `${capacitanceLabel} / ${esrStr}`, status: outStatus },
    { id: 'Rload', type: 'resistor' as const, x: 700, y: 88,  width: 80, height: 80,  label: 'Rload', value: formatResistance(loadR), status: 'normal' as const },
    { id: 'GroundLeft',  type: 'ground' as const, x: 80,  y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' as const },
    { id: 'GroundRight', type: 'ground' as const, x: 608, y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' as const },
  ]

  const showRsense = result?.current_sense?.method === 'resistor'
  if (showRsense) {
    nodes.push({ id: 'gndSense', x: 46, y: 280 })
    components.push({ id: 'Rsense', type: 'resistor' as const, x: 46, y: 262, width: 88, height: 20, label: 'Rsense', value: `${(result!.current_sense!.rsense * 1000).toFixed(2)} mΩ`, status: 'normal' as const, meta: 'Current sense (PCM)' })
    const gl = components.find((c) => c.id === 'GroundLeft')
    if (gl) { gl.x = 34; gl.y = 278 }
  }

  const wire4: SchematicWire[] = showRsense
    ? [
        { id: 'wire4a', points: [nodes[2], { x: 250, y: 266 }, { x: 134, y: 266 }, { x: 134, y: 272 }] },
        { id: 'wire4b', points: [{ x: 46, y: 272 }, { x: 46, y: 276 }] },
      ]
    : [{ id: 'wire4', points: [nodes[2], { x: 250, y: 266 }, nodes[5]] }]

  const wires: SchematicWire[] = [
    { id: 'wire1', points: [nodes[0], { x: 158, y: 102 }, nodes[1]] },
    { id: 'wire2', points: [nodes[1], { x: 350, y: 102 }, nodes[3]] },
    { id: 'wire3', points: [nodes[1], { x: 250, y: 166 }, nodes[2]] },
    ...wire4,
    { id: 'wire5', points: [nodes[3], { x: 510, y: 102 }, nodes[4]] },
    { id: 'wire6', points: [nodes[4], { x: 700, y: 102 }] },
    { id: 'wire7', points: [nodes[4], { x: 620, y: 210 }, nodes[6]] },
    { id: 'wire8', points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 92, y: 132 }] },
    { id: 'wire9', points: [{ x: 130, y: 18 }, { x: 130, y: 34 }] },
  ]

  return { nodes, components, wires }
}
