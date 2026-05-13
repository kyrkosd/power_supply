import type { DesignSpec, DesignResult } from '../../../engine/types'
import type { SchematicDefinition, SchematicNode, ComponentStatus } from '../schematic-types'
import { formatU, formatResistance, formatCapacitance, cinValueLabel } from '../schematic-utils'

// ── Label builders ────────────────────────────────────────────────────────────

type ForwardLabels = {
  turnsValue: string; inductance: string; capacitance: string
  rcdLabel: string; rcdMeta: string
}

/** Pre-computes all display strings so component definitions contain no logic. */
function buildLabels(spec: DesignSpec, result: DesignResult | null, duty: number): ForwardLabels {
  const turnsRatio  = result?.turnsRatio ?? (spec.vinMin * duty) / spec.vout
  const coreLabel   = result?.coreType ?? '—'
  const primaryT    = result?.primaryTurns  ?? 0
  const secondaryT  = result?.secondaryTurns ?? 0
  const snubber     = result?.snubber
  const resetV      = snubber?.V_clamp ?? result?.resetVoltage ?? 0
  return {
    turnsValue:  `${coreLabel} ${primaryT}:${secondaryT}`,
    inductance:  result ? `${formatU(result.inductance  * 1e6, 2, 'µH')}` : '—',
    capacitance: result ? `${formatU(result.capacitance * 1e6, 1, 'µF')}` : '—',
    rcdLabel:    snubber ? `${formatResistance(snubber.R)}, ${formatCapacitance(snubber.C)}` : `Vclamp=${resetV.toFixed(0)}V`,
    rcdMeta:     snubber ? `Vclamp=${resetV.toFixed(0)}V, P=${snubber.P_dissipated.toFixed(1)}W` : 'Reset clamp',
  }
}

// ── Status builders ───────────────────────────────────────────────────────────

type ForwardStatuses = { sw: ComponentStatus; tx: ComponentStatus; rcd: ComponentStatus }

/** Derives warning/violation status for primary MOSFET, transformer, and RCD clamp. */
function buildStatuses(duty: number, result: DesignResult | null, spec: DesignSpec): ForwardStatuses {
  const snubber = result?.snubber
  return {
    sw:  duty >= 0.45 ? 'violation' : duty >= 0.4 ? 'warning' : 'normal',
    tx:  result?.warnings.some(w => w.includes('core')) ? 'warning' : 'normal',
    rcd: snubber && snubber.P_dissipated > 0.05 * spec.vout * spec.iout ? 'warning' : 'normal',
  }
}

// ── Layout builders ───────────────────────────────────────────────────────────

/** Fixed node junction positions for the forward converter layout. */
function buildNodes(): SchematicNode[] {
  return [
    { id: 'vin',         x: 90,  y: 102 },
    { id: 'switch',      x: 230, y: 102 },
    { id: 'transformer', x: 380, y: 102 },
    { id: 'diode1',      x: 530, y: 102 },
    { id: 'inductor',    x: 650, y: 102 },
    { id: 'diode2',      x: 530, y: 220 },
    { id: 'vout',        x: 780, y: 102 },
    { id: 'gndLeft',     x: 90,  y: 280 },
    { id: 'gndRight',    x: 780, y: 280 },
  ]
}

/** Builds the forward wire routing — freewheeling D2 connects back through the output inductor. */
function buildWires(nodes: SchematicNode[]) {
  return [
    { id: 'wire1',  points: [nodes[0], { x: 180, y: 102 }, nodes[1]] },
    { id: 'wire2',  points: [nodes[1], { x: 340, y: 102 }, nodes[2]] },
    { id: 'wire3',  points: [nodes[2], { x: 490, y: 102 }, nodes[3]] },
    { id: 'wire4',  points: [nodes[3], { x: 600, y: 102 }, nodes[4]] },
    { id: 'wire5',  points: [nodes[4], { x: 740, y: 102 }, nodes[6]] },
    { id: 'wire6',  points: [nodes[3], { x: 530, y: 166 }, nodes[5]] },
    { id: 'wire7',  points: [nodes[5], { x: 600, y: 220 }, { x: 600, y: 190 }, nodes[4]] },
    { id: 'wire8',  points: [nodes[6], { x: 780, y: 190 }, nodes[7]] },
    { id: 'wire9',  points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 90, y: 132 }] },
    { id: 'wire10', points: [{ x: 230, y: 58 }, { x: 230, y: 18 }, { x: 130, y: 18 }] },
    { id: 'wire11', points: [{ x: 340, y: 50 }, { x: 310, y: 50 }, { x: 310, y: 10 }] },
  ]
}

// ── Public entry point ────────────────────────────────────────────────────────

export function createForwardSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const duty   = result?.dutyCycle ?? Math.min(Math.max(spec.vout / spec.vinMin, 0.01), 0.45)
  const lbl    = buildLabels(spec, result, duty)
  const st     = buildStatuses(duty, result, spec)
  const nodes  = buildNodes()
  const turnsRatio = result?.turnsRatio ?? (spec.vinMin * duty) / spec.vout
  const resetV     = result?.snubber?.V_clamp ?? result?.resetVoltage ?? 0

  const components = [
    { id: 'Vin',         type: 'source' as const,    x: 50,  y: 50,  width: 76, height: 104, label: 'Vin',  value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`, status: 'normal' as const },
    { id: 'Cin',         type: 'capacitor' as const, x: 150, y: 18,  width: 40, height: 64,  label: 'Cin',  value: cinValueLabel(spec.iout, spec.fsw, spec.vinMin), status: 'normal' as const },
    { id: 'Q1',          type: 'switch' as const,    x: 190, y: 58,  width: 92, height: 112, label: 'Q1',   value: `D=${duty.toFixed(2)}`, status: st.sw, meta: 'Primary MOSFET' },
    { id: 'T1',          type: 'inductor' as const,  x: 340, y: 50,  width: 80, height: 140, label: 'T1',   value: lbl.turnsValue, status: st.tx, meta: `N=${turnsRatio.toFixed(1)}, Vreset=${resetV}V` },
    { id: 'D1',          type: 'diode' as const,     x: 490, y: 58,  width: 92, height: 112, label: 'D1',   value: 'Forward rectifier', status: 'normal' as const },
    { id: 'Lo',          type: 'inductor' as const,  x: 600, y: 74,  width: 80, height: 116, label: 'Lo',   value: lbl.inductance, status: 'normal' as const, meta: 'Output inductor' },
    { id: 'D2',          type: 'diode' as const,     x: 490, y: 186, width: 92, height: 72,  label: 'D2',   value: 'Freewheel diode', status: 'normal' as const },
    { id: 'Cout',        type: 'capacitor' as const, x: 740, y: 40,  width: 78, height: 106, label: 'Cout', value: lbl.capacitance, status: 'normal' as const },
    { id: 'RCD',         type: 'resistor' as const,  x: 280, y: 10,  width: 60, height: 40,  label: 'RCD',  value: lbl.rcdLabel, status: st.rcd, meta: lbl.rcdMeta },
    { id: 'GroundLeft',  type: 'ground' as const,    x: 80,  y: 260, width: 0,  height: 0,   label: '', value: '', status: 'normal' as const },
    { id: 'GroundRight', type: 'ground' as const,    x: 768, y: 260, width: 0,  height: 0,   label: '', value: '', status: 'normal' as const },
  ]

  return { nodes, components, wires: buildWires(nodes) }
}
