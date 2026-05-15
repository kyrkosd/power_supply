import type { DesignSpec, DesignResult } from '../../../engine/types'
import type { SchematicDefinition, SchematicNode, ComponentStatus } from '../schematic-types'
import { formatU, formatResistance, inductorStatusFromResult, switchDutyStatus, cinValueLabel, resultLabel, syncD1Labels } from '../schematic-utils'

// ── Label builders ────────────────────────────────────────────────────────────

type BoostLabels = {
  inductance: string; capacitance: string; esr: string; loadR: string
  d1Label: string; d1Value: string; d1Meta: string | undefined
}

/** Pre-computes all display strings so the component array is pure data. */
function buildLabels(spec: DesignSpec, result: DesignResult | null, duty: number, syncMode: boolean): BoostLabels {
  const outputEsr = result ? Math.max(0.0001, Math.min(spec.voutRippleMax, 0.1) / Math.max(result.peakCurrent, 1e-6)) : NaN
  const d1 = syncD1Labels(syncMode, 'D1', 'Boost diode')
  return {
    inductance:  resultLabel(result, (r) => `${formatU(r.inductance  * 1e6, 2, 'µH')}`),
    capacitance: resultLabel(result, (r) => `${formatU(r.capacitance * 1e6, 1, 'µF')}`),
    esr:         Number.isFinite(outputEsr) ? `${(outputEsr * 1000).toFixed(1)} mΩ ESR` : 'ESR —',
    loadR:       formatResistance(spec.iout > 0 ? spec.vout / spec.iout : NaN),
    d1Label:     d1.label,
    d1Value:     d1.value,
    d1Meta:      d1.meta,
  }
}

// ── Status builders ───────────────────────────────────────────────────────────

type BoostStatuses = { sw: ComponentStatus; ind: ComponentStatus; out: ComponentStatus }

/** Derives warning/violation status for each power component. */
function buildStatuses(duty: number, result: DesignResult | null, spec: DesignSpec): BoostStatuses {
  const esr = result ? Math.max(0.0001, Math.min(spec.voutRippleMax, 0.1) / Math.max(result.peakCurrent, 1e-6)) : 0
  return {
    sw:  switchDutyStatus(duty),
    ind: inductorStatusFromResult(result),
    out: esr > 0.1 ? 'warning' : 'normal',
  }
}

// ── Layout builders ───────────────────────────────────────────────────────────

/** Fixed node junction positions for the boost converter layout. */
function buildNodes(): SchematicNode[] {
  return [
    { id: 'vin',      x: 90,  y: 102 },
    { id: 'inductor', x: 210, y: 102 },
    { id: 'switch',   x: 370, y: 102 },
    { id: 'diode',    x: 370, y: 220 },
    { id: 'vout',     x: 540, y: 102 },
    { id: 'gndLeft',  x: 90,  y: 280 },
    { id: 'gndRight', x: 540, y: 280 },
  ]
}

/** Builds the boost wire routing — return path goes through the switch node to GND. */
function buildWires(nodes: SchematicNode[]) {
  return [
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
}

// ── Public entry point ────────────────────────────────────────────────────────

export function createBoostSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const syncMode = spec.rectification === 'synchronous'
  const duty     = result?.dutyCycle ?? Math.min(Math.max(1 - spec.vinMin / spec.vout, 0.01), 0.99)
  const lbl      = buildLabels(spec, result, duty, syncMode)
  const st       = buildStatuses(duty, result, spec)
  const nodes    = buildNodes()
  const d1Type   = (syncMode ? 'switch' : 'diode') as 'switch' | 'diode'

  const components = [
    { id: 'Vin',         type: 'source' as const,    x: 50,  y: 50,  width: 76, height: 104, label: 'Vin',  value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`, status: 'normal' as const },
    { id: 'L',           type: 'inductor' as const,  x: 190, y: 74,  width: 80, height: 116, label: 'L',    value: lbl.inductance,  status: st.ind },
    { id: 'Q1',          type: 'switch' as const,    x: 340, y: 58,  width: 92, height: 112, label: 'Q1',   value: `D=${duty.toFixed(2)}`, status: st.sw },
    { id: 'D1',          type: d1Type,               x: 340, y: 186, width: 92, height: 72,  label: lbl.d1Label, value: lbl.d1Value, status: 'normal' as const, meta: lbl.d1Meta },
    { id: 'Cout',        type: 'capacitor' as const, x: 520, y: 40,  width: 78, height: 106, label: 'Cout', value: `${lbl.capacitance} / ${lbl.esr}`, status: st.out },
    { id: 'Cin',         type: 'capacitor' as const, x: 150, y: 18,  width: 40, height: 64,  label: 'Cin',  value: cinValueLabel(spec.iout, spec.fsw, spec.vinMax), status: 'normal' as const },
    { id: 'Rload',       type: 'resistor' as const,  x: 680, y: 88,  width: 80, height: 80,  label: 'Rload', value: lbl.loadR, status: 'normal' as const },
    { id: 'GroundLeft',  type: 'ground' as const,    x: 80,  y: 260, width: 0,  height: 0,   label: '', value: '', status: 'normal' as const },
    { id: 'GroundRight', type: 'ground' as const,    x: 528, y: 260, width: 0,  height: 0,   label: '', value: '', status: 'normal' as const },
  ]

  return { nodes, components, wires: buildWires(nodes) }
}
