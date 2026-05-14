// Pure row-builder functions: convert a spec/result into label/value tuples for drawTable.
// Also exposes the loss-section renderer (its layout is data-driven, not chart-driven).

import type { DesignSpec, DesignResult } from '../../engine/types'
import { fmtL, fmtC, fmtR, fmtHz } from '../format-utils'
import { M, CW, fmtPct } from './constants'
import { sectionRule, drawTable, type Doc, type Row } from './primitives'

interface TransformerLosses {
  primaryCopper?:   number
  secondaryCopper?: number
  core?:            number
  mosfet?:          number
  diode?:           number
  clamp?:           number
  total:            number
}

interface SwitchingLosses {
  mosfet_conduction?: number
  mosfet_switching?:  number
  mosfet_gate?:       number
  inductor_copper?:   number
  inductor_core?:     number
  diode_conduction?:  number
  sync_conduction?:   number
  sync_dead_time?:    number
  capacitor_esr?:     number
  total:              number
}

type LossBreakdown = TransformerLosses | SwitchingLosses

const isTransformerLosses = (l: LossBreakdown): l is TransformerLosses => 'primaryCopper' in l
const isSwitchingLosses   = (l: LossBreakdown): l is SwitchingLosses   => 'mosfet_conduction' in l

export function buildSpecRows(spec: DesignSpec): Row[] {
  return [
    ['Input voltage (min)',        `${spec.vinMin} V`],
    ['Input voltage (max)',        `${spec.vinMax} V`],
    ['Output voltage',             `${spec.vout} V`],
    ['Output current (full load)', `${spec.iout} A`],
    ['Switching frequency',        fmtHz(spec.fsw)],
    ['Ripple ratio (ΔiL/Iout)',   `${(spec.rippleRatio * 100).toFixed(0)} %`],
    ['Ambient temperature',        `${spec.ambientTemp} °C`],
    ['Vout ripple max (p-p)',      `${(spec.voutRippleMax * 1000).toFixed(1)} mV`],
    ['Efficiency target',          `${(spec.efficiency * 100).toFixed(0)} %`],
  ]
}

export function buildResultRows(result: DesignResult): Row[] {
  return [
    ['Duty cycle (D)',     fmtPct(result.dutyCycle)],
    ['Inductance (L)',     fmtL(result.inductance)],
    ['Output capacitance', fmtC(result.capacitance)],
    ['Peak ind. current', `${result.peakCurrent.toFixed(2)} A`],
    ['Efficiency (η)',     result.efficiency != null ? fmtPct(result.efficiency) : 'N/A'],
    ['Operating mode',     result.operating_mode ?? 'CCM (estimated)'],
  ]
}

/** Optional rows are pushed only when their underlying value is present. */
function pushOptional(rows: Row[], result: DesignResult): void {
  if (result.efficiency != null)            rows.push(['Efficiency (η)',              fmtPct(result.efficiency)])
  if (result.operating_mode)                rows.push(['Operating mode',               result.operating_mode])
  if (result.ccm_dcm_boundary != null)      rows.push(['CCM→DCM boundary current',   `${result.ccm_dcm_boundary.toFixed(2)} A`])
  if (result.turnsRatio != null)            rows.push(['Turns ratio (Np/Ns)',          result.turnsRatio.toFixed(3)])
  if (result.magnetizingInductance != null) rows.push(['Magnetizing inductance',       fmtL(result.magnetizingInductance)])
  if (result.leakageInductance != null)     rows.push(['Leakage inductance',           fmtL(result.leakageInductance)])
  if (result.clampVoltage != null)          rows.push(['Clamp voltage',               `${result.clampVoltage.toFixed(1)} V`])
  if (result.couplingCapacitance != null)   rows.push(['Coupling capacitor (Cc)',      fmtC(result.couplingCapacitance)])
  if (result.mosfetVdsMax != null)          rows.push(['MOSFET Vds max',              `${result.mosfetVdsMax.toFixed(1)} V`])
  if (result.outputInductance != null)      rows.push(['Output inductance',            fmtL(result.outputInductance)])
  if (result.resetVoltage != null)          rows.push(['Reset winding voltage',       `${result.resetVoltage.toFixed(1)} V`])
}

export function buildComponentRows(result: DesignResult): Row[] {
  const rows: Row[] = [
    ['Inductance (L)',             fmtL(result.inductance)],
    ['Inductor peak current',     `${(result.inductor?.peak_current ?? result.peakCurrent).toFixed(2)} A`],
    ['Inductor RMS current',      `${(result.inductor?.rms_current ?? 0).toFixed(2)} A`],
    ['Output capacitance (Cout)', fmtC(result.capacitance)],
    ['Output cap ESR (max)',       result.output_cap ? fmtR(result.output_cap.esr_max) : '—'],
    ['Cap ripple current (RMS)',  `${(result.output_cap?.ripple_current ?? 0).toFixed(2)} A`],
    ['Duty cycle (D)',             fmtPct(result.dutyCycle)],
    ['Peak switch current',       `${result.peakCurrent.toFixed(2)} A`],
  ]
  pushOptional(rows, result)
  return rows
}

function transformerLossRows(l: TransformerLosses): Row[] {
  return [
    ['Primary copper loss',   `${(l.primaryCopper ?? 0).toFixed(3)} W`],
    ['Secondary copper loss', `${(l.secondaryCopper ?? 0).toFixed(3)} W`],
    ['Core loss',             `${(l.core ?? 0).toFixed(3)} W`],
    ['MOSFET loss',           `${(l.mosfet ?? 0).toFixed(3)} W`],
    ['Diode loss',            `${(l.diode ?? 0).toFixed(3)} W`],
    ['Clamp loss',            `${(l.clamp ?? 0).toFixed(3)} W`],
    ['Total losses',          `${l.total.toFixed(3)} W`],
  ]
}

function switchingLossRows(l: SwitchingLosses): Row[] {
  return [
    ['MOSFET conduction', `${(l.mosfet_conduction ?? 0).toFixed(3)} W`],
    ['MOSFET switching',  `${(l.mosfet_switching  ?? 0).toFixed(3)} W`],
    ['Gate drive',        `${(l.mosfet_gate       ?? 0).toFixed(3)} W`],
    ['Inductor copper',   `${(l.inductor_copper   ?? 0).toFixed(3)} W`],
    ['Inductor core',     `${(l.inductor_core     ?? 0).toFixed(3)} W`],
    ['Diode conduction',  `${(l.diode_conduction  ?? 0).toFixed(3)} W`],
    ['Sync conduction',   `${(l.sync_conduction   ?? 0).toFixed(3)} W`],
    ['Sync dead-time',    `${(l.sync_dead_time    ?? 0).toFixed(3)} W`],
    ['Capacitor ESR',     `${(l.capacitor_esr     ?? 0).toFixed(3)} W`],
    ['Total losses',      `${l.total.toFixed(3)} W`],
  ]
}

/** Render the topology-appropriate loss breakdown table and return the updated y position. */
export function renderLossSection(doc: Doc, result: DesignResult, y: number): number {
  if (!result.losses) return y
  const losses = result.losses as LossBreakdown

  const { title, rows } =
    isTransformerLosses(losses) ? { title: 'Transformer Loss Breakdown', rows: transformerLossRows(losses) } :
    isSwitchingLosses(losses)   ? { title: 'Loss Breakdown',             rows: switchingLossRows(losses) }   :
    { title: '', rows: [] as Row[] }

  if (rows.length === 0) return y
  sectionRule(doc, title, M, y)
  y += 8
  drawTable(doc, rows, M, y, CW)
  return y + rows.length * 6.5 + 14
}
