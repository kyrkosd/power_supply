import type { DesignSpec, DesignResult } from '../../../engine/types'
import type { SchematicDefinition, SchematicNode } from '../schematic-types'
import { formatU, formatResistance, inductorStatusFromResult, switchDutyStatus, cinValueLabel } from '../schematic-utils'

export function createBuckBoostSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const syncMode = spec.rectification === 'synchronous'
  const duty     = result?.dutyCycle ?? Math.min(Math.max(Math.abs(spec.vout) / (spec.vinMin + Math.abs(spec.vout)), 0.01), 0.99)

  const inductanceLabel  = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}` : '—'
  const capacitanceLabel = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'
  const outputEsr        = result ? Math.max(0.0001, Math.min(spec.voutRippleMax, 0.1) / Math.max(result.peakCurrent, 1e-6)) : NaN
  const esrStr           = Number.isFinite(outputEsr) ? `${(outputEsr * 1000).toFixed(1)} mΩ ESR` : 'ESR —'
  const loadR            = spec.iout > 0 ? Math.abs(spec.vout) / spec.iout : NaN
  const swStatus         = switchDutyStatus(duty)
  const indStatus        = inductorStatusFromResult(result)
  const outStatus        = outputEsr > 0.1 ? 'warning' as const : 'normal' as const

  const nodes: SchematicNode[] = [
    { id: 'vin',      x: 90,  y: 102 },
    { id: 'switch',   x: 230, y: 102 },
    { id: 'node',     x: 360, y: 102 },
    { id: 'inductor', x: 490, y: 102 },
    { id: 'vout',     x: 650, y: 102 },
    { id: 'gndLeft',  x: 90,  y: 280 },
    { id: 'gndRight', x: 650, y: 280 },
  ]

  const components = [
    { id: 'Vin',  type: 'source' as const,    x: 50,  y: 50,  width: 76, height: 104, label: 'Vin',  value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`, status: 'normal' as const },
    { id: 'Q1',   type: 'switch' as const,    x: 210, y: 58,  width: 92, height: 112, label: 'Q1',   value: `D=${duty.toFixed(2)}`, status: swStatus },
    { id: 'L',    type: 'inductor' as const,  x: 430, y: 74,  width: 80, height: 116, label: 'L',    value: inductanceLabel, status: indStatus },
    { id: 'D1',   type: (syncMode ? 'switch' : 'diode') as 'switch' | 'diode', x: 330, y: 186, width: 92, height: 72, label: syncMode ? 'Q2' : 'D1', value: syncMode ? 'Sync FET (Rds=8mΩ)' : 'Output diode', status: 'normal' as const, meta: syncMode ? 'Low-side sync FET' : undefined },
    { id: 'Cout', type: 'capacitor' as const, x: 610, y: 40,  width: 78, height: 106, label: 'Cout', value: `${capacitanceLabel} / ${esrStr}`, status: outStatus },
    { id: 'Cin',  type: 'capacitor' as const, x: 150, y: 18,  width: 40, height: 64,  label: 'Cin',  value: cinValueLabel(spec.iout, spec.fsw, spec.vinMin), status: 'normal' as const },
    { id: 'Rload', type: 'resistor' as const, x: 710, y: 88,  width: 80, height: 80,  label: 'Rload', value: formatResistance(loadR), status: 'normal' as const },
    { id: 'GroundLeft',  type: 'ground' as const, x: 80,  y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' as const },
    { id: 'GroundRight', type: 'ground' as const, x: 628, y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' as const },
  ]

  const wires = [
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
