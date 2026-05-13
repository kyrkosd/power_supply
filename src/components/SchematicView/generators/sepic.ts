import type { DesignSpec, DesignResult } from '../../../engine/types'
import type { SchematicDefinition, SchematicNode, ComponentStatus } from '../schematic-types'
import { formatU, cinValueLabel } from '../schematic-utils'

export function createSepicSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty             = result?.dutyCycle ?? Math.min(Math.max(spec.vout / (spec.vinMin + spec.vout), 0.05), 0.95)
  const inputInductance  = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}` : '—'
  const outputInductance = result?.outputInductance ? `${formatU(result.outputInductance * 1e6, 2, 'µH')}` : '—'
  const couplingCap      = result?.couplingCapacitance ? `${formatU(result.couplingCapacitance * 1e6, 1, 'µF')}` : '—'
  const outputCap        = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'
  const swStatus: ComponentStatus = duty >= 0.8 || duty <= 0.2 ? 'warning' : 'normal'

  const nodes: SchematicNode[] = [
    { id: 'vin',      x: 90,  y: 102 },
    { id: 'l1',       x: 230, y: 102 },
    { id: 'cc',       x: 370, y: 102 },
    { id: 'l2',       x: 370, y: 220 },
    { id: 'switch',   x: 510, y: 220 },
    { id: 'diode',    x: 510, y: 102 },
    { id: 'vout',     x: 650, y: 102 },
    { id: 'gndLeft',  x: 90,  y: 280 },
    { id: 'gndRight', x: 650, y: 280 },
  ]

  const components = [
    { id: 'Vin',  type: 'source' as const,    x: 50,  y: 50,  width: 76, height: 104, label: 'Vin',  value: `${spec.vinMin.toFixed(1)}–${spec.vinMax.toFixed(1)} V`, status: 'normal' as const },
    { id: 'L1',   type: 'inductor' as const,  x: 170, y: 74,  width: 80, height: 116, label: 'L1',   value: inputInductance,  status: 'normal' as const, meta: 'Input inductor' },
    { id: 'Cc',   type: 'capacitor' as const, x: 320, y: 40,  width: 78, height: 106, label: 'Cc',   value: couplingCap,       status: 'normal' as const, meta: 'Coupling capacitor' },
    { id: 'L2',   type: 'inductor' as const,  x: 320, y: 186, width: 80, height: 116, label: 'L2',   value: outputInductance,  status: 'normal' as const, meta: 'Output inductor' },
    { id: 'Q1',   type: 'switch' as const,    x: 470, y: 186, width: 92, height: 112, label: 'Q1',   value: `D=${duty.toFixed(2)}`, status: swStatus, meta: 'MOSFET' },
    { id: 'D1',   type: 'diode' as const,     x: 470, y: 58,  width: 92, height: 112, label: 'D1',   value: 'Output diode',    status: 'normal' as const },
    { id: 'Cout', type: 'capacitor' as const, x: 610, y: 40,  width: 78, height: 106, label: 'Cout', value: outputCap,         status: 'normal' as const },
    { id: 'Cin',  type: 'capacitor' as const, x: 130, y: 18,  width: 40, height: 64,  label: 'Cin',  value: cinValueLabel(spec.iout, spec.fsw, spec.vinMin), status: 'normal' as const },
    { id: 'GroundLeft',  type: 'ground' as const, x: 80,  y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' as const },
    { id: 'GroundRight', type: 'ground' as const, x: 638, y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' as const },
  ]

  const wires = [
    { id: 'wire1',  points: [nodes[0], { x: 170, y: 102 }, nodes[1]] },
    { id: 'wire2',  points: [nodes[1], { x: 320, y: 102 }, nodes[2]] },
    { id: 'wire3',  points: [nodes[2], { x: 470, y: 102 }, nodes[5]] },
    { id: 'wire4',  points: [nodes[5], { x: 610, y: 102 }, nodes[6]] },
    { id: 'wire5',  points: [nodes[2], { x: 370, y: 146 }, nodes[3]] },
    { id: 'wire6',  points: [nodes[3], { x: 470, y: 220 }, nodes[4]] },
    { id: 'wire7',  points: [nodes[4], { x: 510, y: 280 }, nodes[7]] },
    { id: 'wire8',  points: [nodes[6], { x: 650, y: 190 }, nodes[8]] },
    { id: 'wire9',  points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 90, y: 132 }] },
    { id: 'wire10', points: [{ x: 230, y: 58 }, { x: 230, y: 18 }, { x: 130, y: 18 }] },
  ]

  return { nodes, components, wires }
}
