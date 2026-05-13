import type { DesignSpec, DesignResult } from '../../../engine/types'
import type { SchematicDefinition, SchematicNode, SchematicComponent, SchematicWire } from '../schematic-types'
import { formatU, formatResistance, formatCapacitance, cinValueLabel } from '../schematic-utils'

function buildSecondaryOutput(
  index: number,
  vout: number,
  capacitance: number | undefined,
  nodes: SchematicNode[],
  components: SchematicComponent[],
  wires: SchematicWire[],
): void {
  const yOff    = 320 + index * 90
  const capLabel = capacitance != null ? `${formatU(capacitance * 1e6, 1, 'µF')}` : '—'

  wires.push({ id: `wireSec${index}tap`, points: [{ x: 420, y: 102 + index * 90 + 80 }, { x: 490, y: 102 + index * 90 + 80 }] })
  components.push(
    { id: `D${index + 2}`,    type: 'diode' as const,     x: 490, y: yOff - 32, width: 92, height: 72, label: `D${index + 2}`,    value: `Out ${index + 2}: ${vout.toFixed(1)} V`, status: 'normal' as const },
    { id: `Cout${index + 2}`, type: 'capacitor' as const, x: 640, y: yOff - 50, width: 60, height: 80, label: `Cout${index + 2}`, value: capLabel, status: 'normal' as const },
    { id: `GND${index + 2}`,  type: 'ground' as const,    x: 668, y: yOff + 44, width: 0,  height: 0,  label: '', value: '', status: 'normal' as const },
  )
  nodes.push({ id: `sec${index}out`, x: 668, y: yOff })
  wires.push(
    { id: `wireSec${index}a`, points: [{ x: 582, y: yOff }, { x: 640, y: yOff }] },
    { id: `wireSec${index}b`, points: [{ x: 668, y: yOff }, { x: 668, y: yOff + 44 }] },
  )
}

export function createFlybackSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty          = result?.dutyCycle ?? Math.min(Math.max(spec.vout / (spec.vinMin + spec.vout), 0.01), 0.45)
  const turnsRatio    = result?.turnsRatio ?? (spec.vinMin * duty) / spec.vout
  const inductanceLbl = result ? `${formatU(result.inductance * 1e6, 2, 'µH')}` : '—'
  const capacitanceLbl = result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—'
  const coreLabel     = result?.coreType ?? '—'
  const primaryTurns  = result?.primaryTurns ?? 0
  const secondaryTurns = result?.secondaryTurns ?? 0
  const snubber       = result?.snubber
  const clampV        = snubber?.V_clamp ?? result?.clampVoltage ?? 0
  const secondaries   = spec.secondary_outputs ?? []

  const swStatus   = duty >= 0.45 ? 'violation' as const : duty >= 0.4 ? 'warning' as const : 'normal' as const
  const txStatus   = result?.warnings.some(w => w.includes('core')) ? 'warning' as const : 'normal' as const
  const rcdStatus  = snubber && snubber.P_dissipated > 0.05 * spec.vout * spec.iout ? 'warning' as const : 'normal' as const

  const turnsLabel = secondaries.length > 0
    ? `${primaryTurns}:${secondaryTurns}+${secondaries.length}`
    : `${coreLabel} ${primaryTurns}:${secondaryTurns}`
  const rcdLabel   = snubber ? `${formatResistance(snubber.R)}, ${formatCapacitance(snubber.C)}` : `Vclamp=${clampV.toFixed(0)}V`

  const nodes: SchematicNode[] = [
    { id: 'vin',         x: 90,  y: 102 },
    { id: 'switch',      x: 230, y: 102 },
    { id: 'transformer', x: 380, y: 102 },
    { id: 'diode',       x: 530, y: 102 },
    { id: 'vout',        x: 680, y: 102 },
    { id: 'gndLeft',     x: 90,  y: 280 },
    { id: 'gndRight',    x: 680, y: 280 },
  ]

  const components: SchematicComponent[] = [
    { id: 'Vin',  type: 'source' as const,    x: 50,  y: 50,  width: 76, height: 104, label: 'Vin',  value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`, status: 'normal' as const },
    { id: 'Cin',  type: 'capacitor' as const, x: 150, y: 18,  width: 40, height: 64,  label: 'Cin',  value: cinValueLabel(spec.iout, spec.fsw, spec.vinMin), status: 'normal' as const },
    { id: 'Q1',   type: 'switch' as const,    x: 190, y: 58,  width: 92, height: 112, label: 'Q1',   value: `D=${duty.toFixed(2)}`, status: swStatus, meta: 'Primary MOSFET' },
    { id: 'T1',   type: 'inductor' as const,  x: 340, y: 50,  width: 80, height: 140, label: 'T1',   value: turnsLabel, status: txStatus, meta: `Lm=${inductanceLbl}, N=${turnsRatio.toFixed(1)}` },
    { id: 'RCD',  type: 'resistor' as const,  x: 300, y: 10,  width: 60, height: 40,  label: 'RCD',  value: rcdLabel, status: rcdStatus, meta: snubber ? `Vclamp=${clampV.toFixed(0)}V, P=${snubber.P_dissipated.toFixed(1)}W` : 'Clamp circuit' },
    { id: 'D1',   type: 'diode' as const,     x: 490, y: 58,  width: 92, height: 112, label: 'D1',   value: 'Regulated out', status: 'normal' as const },
    { id: 'Cout', type: 'capacitor' as const, x: 640, y: 40,  width: 78, height: 106, label: 'Cout', value: capacitanceLbl, status: 'normal' as const },
    { id: 'GroundLeft',  type: 'ground' as const, x: 80,  y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' as const },
    { id: 'GroundRight', type: 'ground' as const, x: 668, y: 260, width: 0, height: 0, label: '', value: '', status: 'normal' as const },
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

  secondaries.forEach((s, i) =>
    buildSecondaryOutput(i, s.vout, result?.secondaryOutputResults?.[i]?.capacitance, nodes, components, wires),
  )

  return { nodes, components, wires }
}
