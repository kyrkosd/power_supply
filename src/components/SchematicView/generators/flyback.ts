import type { DesignSpec, DesignResult } from '../../../engine/types'
import type { SchematicDefinition, SchematicNode, SchematicComponent, SchematicWire, ComponentStatus } from '../schematic-types'
import { formatU, formatResistance, formatCapacitance, cinValueLabel, flybackDutyStatus, rcdClampStatus, resultLabel } from '../schematic-utils'

// ── Secondary output builder ──────────────────────────────────────────────────

/**
 * Appends one secondary winding circuit (diode + cap + GND) below the primary output.
 * Each additional output is stacked 90 px further down than the previous.
 * Mutates nodes/components/wires — all are local to createFlybackSchematic.
 */
function addSecondaryOutput(
  index: number,
  vout: number,
  capacitance: number | undefined,
  nodes: SchematicNode[],
  components: SchematicComponent[],
  wires: SchematicWire[],
): void {
  const yOff     = 320 + index * 90
  const capLabel = capacitance != null ? `${formatU(capacitance * 1e6, 1, 'µF')}` : '—'
  wires.push({ id: `wireSec${index}tap`, points: [{ x: 420, y: 102 + index * 90 + 80 }, { x: 490, y: 102 + index * 90 + 80 }] })
  components.push(
    { id: `D${index + 2}`,    type: 'diode',     x: 490, y: yOff - 32, width: 92, height: 72, label: `D${index + 2}`,    value: `Out ${index + 2}: ${vout.toFixed(1)} V`, status: 'normal' },
    { id: `Cout${index + 2}`, type: 'capacitor', x: 640, y: yOff - 50, width: 60, height: 80, label: `Cout${index + 2}`, value: capLabel, status: 'normal' },
    { id: `GND${index + 2}`,  type: 'ground',    x: 668, y: yOff + 44, width: 0,  height: 0,  label: '', value: '', status: 'normal' },
  )
  nodes.push({ id: `sec${index}out`, x: 668, y: yOff })
  wires.push(
    { id: `wireSec${index}a`, points: [{ x: 582, y: yOff }, { x: 640, y: yOff }] },
    { id: `wireSec${index}b`, points: [{ x: 668, y: yOff }, { x: 668, y: yOff + 44 }] },
  )
}

// ── Label builders ────────────────────────────────────────────────────────────

type FlybackLabels = {
  turnsLabel: string; rcdLabel: string
  inductance: string; capacitance: string
  clampMeta: string
}

/** Pre-computes all display strings so component definitions contain no logic. */
function buildLabels(spec: DesignSpec, result: DesignResult | null): FlybackLabels {
  const primaryT    = result?.primaryTurns  ?? 0
  const secondaryT  = result?.secondaryTurns ?? 0
  const coreLabel   = result?.coreType ?? '—'
  const snubber     = result?.snubber
  const clampV      = snubber?.V_clamp ?? result?.clampVoltage ?? 0
  const secondaries = spec.secondary_outputs ?? []
  const turnsLabel  = secondaries.length > 0
    ? `${primaryT}:${secondaryT}+${secondaries.length}`
    : `${coreLabel} ${primaryT}:${secondaryT}`
  return {
    turnsLabel,
    inductance:  resultLabel(result, (r) => `${formatU(r.inductance  * 1e6, 2, 'µH')}`),
    capacitance: resultLabel(result, (r) => `${formatU(r.capacitance * 1e6, 1, 'µF')}`),
    rcdLabel:    snubber ? `${formatResistance(snubber.R)}, ${formatCapacitance(snubber.C)}` : `Vclamp=${clampV.toFixed(0)}V`,
    clampMeta:   snubber ? `Vclamp=${clampV.toFixed(0)}V, P=${snubber.P_dissipated.toFixed(1)}W` : 'Clamp circuit',
  }
}

// ── Status builders ───────────────────────────────────────────────────────────

type FlybackStatuses = { sw: ComponentStatus; tx: ComponentStatus; rcd: ComponentStatus }

/** Derives warning/violation status for primary MOSFET, transformer, and RCD clamp. */
function buildStatuses(duty: number, result: DesignResult | null, spec: DesignSpec): FlybackStatuses {
  const snubber = result?.snubber
  return {
    sw:  flybackDutyStatus(duty),
    tx:  result?.warnings.some(w => w.includes('core')) ? 'warning' : 'normal',
    rcd: rcdClampStatus(snubber, spec.vout * spec.iout),
  }
}

// ── Layout builders ───────────────────────────────────────────────────────────

/** Fixed node junction positions for the flyback converter layout. */
function buildNodes(): SchematicNode[] {
  return [
    { id: 'vin',         x: 90,  y: 102 },
    { id: 'switch',      x: 230, y: 102 },
    { id: 'transformer', x: 380, y: 102 },
    { id: 'diode',       x: 530, y: 102 },
    { id: 'vout',        x: 680, y: 102 },
    { id: 'gndLeft',     x: 90,  y: 280 },
    { id: 'gndRight',    x: 680, y: 280 },
  ]
}

/** Builds the flyback wire routing — transformer bridges primary and secondary sides. */
function buildWires(nodes: SchematicNode[]): SchematicWire[] {
  return [
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
}

// ── Public entry point ────────────────────────────────────────────────────────

export function createFlybackSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty   = result?.dutyCycle ?? Math.min(Math.max(spec.vout / (spec.vinMin + spec.vout), 0.01), 0.45)
  const lbl    = buildLabels(spec, result, duty)
  const st     = buildStatuses(duty, result, spec)
  const nodes  = buildNodes()
  const wires  = buildWires(nodes)

  const components: SchematicComponent[] = [
    { id: 'Vin',         type: 'source',    x: 50,  y: 50,  width: 76, height: 104, label: 'Vin',  value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`, status: 'normal' },
    { id: 'Cin',         type: 'capacitor', x: 150, y: 18,  width: 40, height: 64,  label: 'Cin',  value: cinValueLabel(spec.iout, spec.fsw, spec.vinMin), status: 'normal' },
    { id: 'Q1',          type: 'switch',    x: 190, y: 58,  width: 92, height: 112, label: 'Q1',   value: `D=${duty.toFixed(2)}`, status: st.sw, meta: 'Primary MOSFET' },
    { id: 'T1',          type: 'inductor',  x: 340, y: 50,  width: 80, height: 140, label: 'T1',   value: lbl.turnsLabel, status: st.tx, meta: `Lm=${lbl.inductance}` },
    { id: 'RCD',         type: 'resistor',  x: 300, y: 10,  width: 60, height: 40,  label: 'RCD',  value: lbl.rcdLabel,   status: st.rcd, meta: lbl.clampMeta },
    { id: 'D1',          type: 'diode',     x: 490, y: 58,  width: 92, height: 112, label: 'D1',   value: 'Regulated out', status: 'normal' },
    { id: 'Cout',        type: 'capacitor', x: 640, y: 40,  width: 78, height: 106, label: 'Cout', value: lbl.capacitance, status: 'normal' },
    { id: 'GroundLeft',  type: 'ground',    x: 80,  y: 260, width: 0,  height: 0,   label: '', value: '', status: 'normal' },
    { id: 'GroundRight', type: 'ground',    x: 668, y: 260, width: 0,  height: 0,   label: '', value: '', status: 'normal' },
  ]

  const secondaries = spec.secondary_outputs ?? []
  secondaries.forEach((s, i) =>
    addSecondaryOutput(i, s.vout, result?.secondaryOutputResults?.[i]?.capacitance, nodes, components, wires),
  )

  return { nodes, components, wires }
}
