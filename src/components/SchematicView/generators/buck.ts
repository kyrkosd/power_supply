import type { DesignSpec, DesignResult } from '../../../engine/types'
import type { SchematicDefinition, SchematicNode, SchematicComponent, SchematicWire, ComponentStatus } from '../schematic-types'
import { formatU, formatResistance, inductorStatusFromResult, switchDutyStatus, cinValueLabel, resultLabel } from '../schematic-utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Ripple cancellation factor K for N-phase interleaved buck (Erickson §12.3). */
function rippleFactor(N: number, duty: number): number {
  if (N <= 1) return 1
  const ND    = N * duty
  const delta = ND - Math.floor(ND)
  if (delta < 1e-6 || delta > 1 - 1e-6) return 0
  return Math.min((delta * (1 - delta)) / (N * duty * (1 - duty)), 1)
}

/** ESR derived from the output ripple budget and inductor volt-second balance. */
function computeOutputEsr(spec: DesignSpec, result: DesignResult, duty: number): number {
  const deltaIL = Math.abs((spec.vout * (1 - duty)) / (result.inductance * spec.fsw))
  return Math.max(0.0001, spec.voutRippleMax / Math.max(deltaIL / (2 * Math.sqrt(3)), 1e-6))
}

// ── Label builders ────────────────────────────────────────────────────────────

interface SyncFetProps { label: string; value: string; meta: string | undefined }
function syncFetProps(syncMode: boolean, pv: PhaseVariants): SyncFetProps {
  if (syncMode) return { label: pv.d1LabelSync, value: `Rds=8mΩ${pv.nSfx}`, meta: 'Low-side sync FET (replaces freewheeling diode)' }
  return { label: pv.d1LabelDiode, value: pv.d1ValueDiode, meta: undefined }
}

interface PhaseVariants {
  phSfx: string; nSfx: string
  q1Label: string; q1Meta: string
  d1LabelSync: string; d1LabelDiode: string; d1ValueDiode: string
  lLabel: string; lMeta: string | undefined
}

function buildPhaseVariants(N: number, K: number): PhaseVariants {
  if (N <= 1) return {
    phSfx: '', nSfx: '',
    q1Label: 'Q1', q1Meta: 'High-side MOSFET',
    d1LabelSync: 'Q2', d1LabelDiode: 'D1', d1ValueDiode: 'Freewheel diode',
    lLabel: 'L', lMeta: undefined,
  }
  return {
    phSfx:        '/ph',
    nSfx:         ` ×${N}`,
    q1Label:      `Q1–Q${N}`,
    q1Meta:       `${N} high-side MOSFETs interleaved — ${(360 / N).toFixed(0)}° phase shift`,
    d1LabelSync:  `Q2–Q${N + 1}`,
    d1LabelDiode: `D1–D${N}`,
    d1ValueDiode: `Freewheel ×${N}`,
    lLabel:       `L1–L${N}`,
    lMeta:        `Per-phase inductance. Ripple cancellation K=${K.toFixed(2)} (0=perfect).`,
  }
}

type BuckLabels = {
  inductance: string; capacitance: string; esr: string; loadR: string
  q1Label: string; q1Value: string; q1Meta: string
  d1Label: string; d1Value: string; d1Meta: string | undefined
  lLabel:  string; lMeta:  string | undefined
}

/** Pre-computes every display string so the component array remains logic-free. */
function buildLabels(spec: DesignSpec, result: DesignResult | null, N: number, duty: number, K: number, syncMode: boolean, esr: number): BuckLabels {
  const pv   = buildPhaseVariants(N, K)
  const d1   = syncFetProps(syncMode, pv)
  return {
    inductance:  resultLabel(result, (r) => `${formatU(r.inductance  * 1e6, 2, 'µH')}${pv.phSfx}`),
    capacitance: resultLabel(result, (r) => `${formatU(r.capacitance * 1e6, 1, 'µF')}`),
    esr:         Number.isFinite(esr) ? `${(esr * 1000).toFixed(1)} mΩ ESR` : 'ESR —',
    loadR:       formatResistance(spec.iout > 0 ? spec.vout / spec.iout : NaN),
    q1Label:     pv.q1Label,
    q1Value:     `D=${duty.toFixed(2)}${pv.nSfx}`,
    q1Meta:      pv.q1Meta,
    d1Label:     d1.label,
    d1Value:     d1.value,
    d1Meta:      d1.meta,
    lLabel:      pv.lLabel,
    lMeta:       pv.lMeta,
  }
}

// ── Status builders ───────────────────────────────────────────────────────────

type BuckStatuses = { sw: ComponentStatus; ind: ComponentStatus; out: ComponentStatus }

/** Derives warning/violation status for each power stage component. */
function buildStatuses(duty: number, esr: number, result: DesignResult | null): BuckStatuses {
  return {
    sw:  switchDutyStatus(duty),
    ind: inductorStatusFromResult(result),
    out: esr > 0.1 ? 'warning' : 'normal',
  }
}

// ── Layout builders ───────────────────────────────────────────────────────────

/** Fixed node junction positions for the buck converter layout. */
function buildNodes(): SchematicNode[] {
  return [
    { id: 'vin',      x: 92,  y: 102 },
    { id: 'switch',   x: 250, y: 102 },
    { id: 'diode',    x: 250, y: 220 },
    { id: 'inductor', x: 430, y: 102 },
    { id: 'vout',     x: 620, y: 102 },
    { id: 'gndLeft',  x: 92,  y: 280 },
    { id: 'gndRight', x: 620, y: 280 },
  ]
}

/**
 * Inserts the current-sense resistor into the low-side return path.
 * Only called when peak-current-mode control is active (spec.controlMode === 'current').
 * Mutates nodes/components in-place — both arrays are local to createBuckSchematic.
 */
function addRsense(nodes: SchematicNode[], components: SchematicComponent[], result: DesignResult | null): void {
  if (result?.current_sense?.method !== 'resistor') return
  nodes.push({ id: 'gndSense', x: 46, y: 280 })
  components.push({ id: 'Rsense', type: 'resistor', x: 46, y: 262, width: 88, height: 20, label: 'Rsense', value: `${(result.current_sense.rsense * 1000).toFixed(2)} mΩ`, status: 'normal', meta: 'Current sense (PCM)' })
  const gl = components.find((c) => c.id === 'GroundLeft')
  if (gl) { gl.x = 34; gl.y = 278 }
}

/** Builds wire routing; forks the return path when Rsense is present. */
function buildWires(nodes: SchematicNode[], showRsense: boolean): SchematicWire[] {
  const returnPath: SchematicWire[] = showRsense
    ? [
        { id: 'wire4a', points: [nodes[2], { x: 250, y: 266 }, { x: 134, y: 266 }, { x: 134, y: 272 }] },
        { id: 'wire4b', points: [{ x: 46, y: 272 }, { x: 46, y: 276 }] },
      ]
    : [{ id: 'wire4', points: [nodes[2], { x: 250, y: 266 }, nodes[5]] }]
  return [
    { id: 'wire1', points: [nodes[0], { x: 158, y: 102 }, nodes[1]] },
    { id: 'wire2', points: [nodes[1], { x: 350, y: 102 }, nodes[3]] },
    { id: 'wire3', points: [nodes[1], { x: 250, y: 166 }, nodes[2]] },
    ...returnPath,
    { id: 'wire5', points: [nodes[3], { x: 510, y: 102 }, nodes[4]] },
    { id: 'wire6', points: [nodes[4], { x: 700, y: 102 }] },
    { id: 'wire7', points: [nodes[4], { x: 620, y: 210 }, nodes[6]] },
    { id: 'wire8', points: [{ x: 130, y: 18 }, { x: 130, y: 132 }, { x: 92, y: 132 }] },
    { id: 'wire9', points: [{ x: 130, y: 18 }, { x: 130, y: 34 }] },
  ]
}

// ── Public entry point ────────────────────────────────────────────────────────

export function createBuckSchematic(spec: DesignSpec, result: DesignResult | null): SchematicDefinition {
  const N        = Math.max(1, Math.min(6, Math.round(spec.phases ?? 1)))
  const syncMode = spec.rectification === 'synchronous'
  const duty     = result?.dutyCycle ?? Math.min(Math.max(spec.vout / spec.vinMax, 0.01), 0.99)
  const K        = rippleFactor(N, duty)
  const esr      = result ? computeOutputEsr(spec, result, duty) : NaN
  const lbl      = buildLabels(spec, result, N, duty, K, syncMode, esr)
  const st       = buildStatuses(duty, esr, result)
  const nodes    = buildNodes()
  const d1Type   = (syncMode ? 'switch' : 'diode') as 'switch' | 'diode'

  const components: SchematicComponent[] = [
    { id: 'Vin',         type: 'source',    x: 50,  y: 50,  width: 76, height: 104, label: 'Vin',       value: `${spec.vinMin.toFixed(0)}–${spec.vinMax.toFixed(0)} V`, status: 'normal', meta: 'Input source' },
    { id: 'Cin',         type: 'capacitor', x: 170, y: 18,  width: 40, height: 64,  label: 'Cin',       value: cinValueLabel(spec.iout, spec.fsw, spec.vinMax), status: 'normal' },
    { id: 'Q1',          type: 'switch',    x: 200, y: 58,  width: 92, height: 112, label: lbl.q1Label, value: lbl.q1Value,    status: st.sw,  meta: lbl.q1Meta },
    { id: 'D1',          type: d1Type,      x: 200, y: 186, width: 92, height: 72,  label: lbl.d1Label, value: lbl.d1Value,    status: 'normal', meta: lbl.d1Meta },
    { id: 'L',           type: 'inductor',  x: 390, y: 74,  width: 80, height: 116, label: lbl.lLabel,  value: lbl.inductance, status: st.ind, meta: lbl.lMeta },
    { id: 'Cout',        type: 'capacitor', x: 560, y: 40,  width: 78, height: 106, label: 'Cout',      value: `${lbl.capacitance} / ${lbl.esr}`, status: st.out },
    { id: 'Rload',       type: 'resistor',  x: 700, y: 88,  width: 80, height: 80,  label: 'Rload',     value: lbl.loadR, status: 'normal' },
    { id: 'GroundLeft',  type: 'ground',    x: 80,  y: 260, width: 0,  height: 0,   label: '',          value: '', status: 'normal' },
    { id: 'GroundRight', type: 'ground',    x: 608, y: 260, width: 0,  height: 0,   label: '',          value: '', status: 'normal' },
  ]

  addRsense(nodes, components, result)
  const wires = buildWires(nodes, result?.current_sense?.method === 'resistor')
  return { nodes, components, wires }
}
