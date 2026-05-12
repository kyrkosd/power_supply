// Bill of Materials generator: assembles per-component BOM rows and serialises
// to CSV with per-topology voltage-stress ratings and auto-suggested parts.

import {
  suggestInductors,
  suggestCapacitors,
  suggestMosfets,
} from '../engine/component-selector'
import type { SelectedComponents } from '../engine/component-selector'
import type { DesignSpec, DesignResult } from '../engine/types'
import { designFeedback, fmtResistor } from '../engine/feedback'
import type { FeedbackOptions } from '../engine/feedback'
import { designSoftStart } from '../engine/soft-start'
import type { SoftStartOptions } from '../engine/soft-start'
import { fmtL, fmtC, fmtR, fmtHz } from './format-utils'

export type { SelectedComponents }

// ── CSV serialisation ─────────────────────────────────────────────────────────

function csvCell(value: string | number | null | undefined): string {
  const s = String(value ?? '-')
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

interface BOMRow {
  ref:          string
  component:    string
  value:        string
  rating:       string
  pkg:          string
  manufacturer: string
  partNumber:   string
  qty:          number
  notes:        string
}

function rowToCsv(r: BOMRow): string {
  return [
    r.ref, r.component, r.value, r.rating,
    r.pkg, r.manufacturer, r.partNumber, String(r.qty), r.notes,
  ].map(csvCell).join(',')
}

// ── Voltage-stress calculations per topology ──────────────────────────────────

const DERATING = 1.25 // 25 % voltage margin

interface StressCalc {
  mosfetVds: number
  diodeVr:   number
}

function voltageStress(topology: string, spec: DesignSpec, result: DesignResult): StressCalc {
  const { vinMax, vout } = spec
  switch (topology) {
    case 'boost':
      return { mosfetVds: vout * DERATING, diodeVr: vout * DERATING }
    case 'buck-boost':
      return { mosfetVds: (vinMax + vout) * DERATING, diodeVr: (vinMax + vout) * DERATING }
    case 'sepic':
      return {
        mosfetVds: (result.mosfetVdsMax != null ? result.mosfetVdsMax : vinMax + vout) * DERATING,
        diodeVr:   (result.diodeVrMax   != null ? result.diodeVrMax   : vinMax + vout) * DERATING,
      }
    case 'flyback': {
      const vdsMin = (result.clampVoltage != null ? result.clampVoltage : vinMax * 2) * DERATING
      const vrMin  = (vinMax / (result.turnsRatio ?? 5) + vout) * DERATING
      return { mosfetVds: vdsMin, diodeVr: vrMin }
    }
    case 'forward':
      return { mosfetVds: vinMax * 2 * DERATING, diodeVr: vout * 2 * DERATING }
    default: // buck
      return { mosfetVds: vinMax * DERATING, diodeVr: vinMax * DERATING }
  }
}

// ── Component estimate helpers ────────────────────────────────────────────────

/** Input cap estimate: Cin ≥ Ipeak·D / (fsw·ΔVin_pp); ΔVin_pp = 2 % of Vin_min. */
function estimateCin_uF(spec: DesignSpec, result: DesignResult): number {
  const deltaVin = spec.vinMin * 0.02
  return Math.max(10, Math.ceil((result.peakCurrent * result.dutyCycle) / (spec.fsw * deltaVin) * 1e6))
}

/** DCR budget: allow ≤ 1 % of Vout to drop across DCR at full load. */
function maxDcr_mOhm(spec: DesignSpec): number {
  return ((spec.vout * 0.01) / spec.iout) * 1e3
}

// ── Per-component row builders ────────────────────────────────────────────────

/** Q1 — Power MOSFET row. Auto-suggests from database when no part is selected. */
function buildQ1Row(mosfetVds: number, result: DesignResult, selected: SelectedComponents): BOMRow {
  const mosfet = selected.mosfet ?? suggestMosfets(mosfetVds)[0] ?? null
  return {
    ref:          'Q1',
    component:    'MOSFET',
    value:        '-',
    rating:       `Vds≥${mosfetVds.toFixed(0)} V; Rds≤${mosfetVds <= 60 ? 10 : 50} mΩ; Id≥${result.peakCurrent.toFixed(1)} A`,
    pkg:          mosfet?.package ?? '-',
    manufacturer: mosfet?.manufacturer ?? '-',
    partNumber:   mosfet?.part_number ?? '-',
    qty:          1,
    notes:        mosfet
      ? `Rds_on: ${mosfet.rds_on_mohm} mΩ; Qg: ${mosfet.qg_nc} nC; Id_max: ${mosfet.id_max_a} A`
      : 'No match in database — check requirements',
  }
}

/** D1 — Schottky rectifier or Q2 sync FET row (determined by rectification mode). */
function buildD1Row(
  topology: string,
  spec: DesignSpec,
  mosfetVds: number,
  diodeVr: number,
  isSyncMode: boolean,
): BOMRow {
  if (isSyncMode) {
    const syncFet = suggestMosfets(mosfetVds).slice().sort((a, b) => a.rds_on_mohm - b.rds_on_mohm)[0] ?? null
    return {
      ref:          'Q2',
      component:    'MOSFET (Sync)',
      value:        '-',
      rating:       `Vds≥${mosfetVds.toFixed(0)} V; Rds≤8 mΩ; Id≥${spec.iout.toFixed(1)} A`,
      pkg:          syncFet?.package ?? '-',
      manufacturer: syncFet?.manufacturer ?? '-',
      partNumber:   syncFet?.part_number ?? '-',
      qty:          spec.phases ?? 1,
      notes:        syncFet
        ? `Low-side sync FET: Rds=${syncFet.rds_on_mohm} mΩ; Qg=${syncFet.qg_nc} nC — optimise for low Rds_on`
        : 'Low-side sync FET — no match in database; check Rds_on < 10 mΩ',
    }
  }
  return {
    ref:          'D1',
    component:    'Schottky Diode',
    value:        '-',
    rating:       `Vr≥${diodeVr.toFixed(0)} V; If≥${spec.iout.toFixed(1)} A`,
    pkg:          '-',
    manufacturer: '-',
    partNumber:   '-',
    qty:          1,
    notes:        topology === 'flyback' || topology === 'forward'
      ? 'Secondary-side rectifier'
      : 'Asynchronous; replace with sync MOSFET to improve light-load efficiency',
  }
}

/** D2 — Forward converter freewheeling diode row. */
function buildD2Row(diodeVr: number, spec: DesignSpec): BOMRow {
  return {
    ref: 'D2', component: 'Schottky Diode', value: '-',
    rating: `Vr≥${diodeVr.toFixed(0)} V; If≥${spec.iout.toFixed(1)} A`,
    pkg: '-', manufacturer: '-', partNumber: '-', qty: 1,
    notes: 'Freewheeling diode',
  }
}

/** T1 — Transformer row with turns-ratio and core-type specs (flyback/forward only). */
function buildT1Row(topology: string, spec: DesignSpec, result: DesignResult): BOMRow {
  const txSpecs: string[] = []
  if (result.turnsRatio           != null) txSpecs.push(`Np/Ns: ${result.turnsRatio.toFixed(2)}`)
  if (result.primaryTurns         != null) txSpecs.push(`Np: ${result.primaryTurns}`)
  if (result.secondaryTurns       != null) txSpecs.push(`Ns: ${result.secondaryTurns}`)
  if (result.magnetizingInductance != null) txSpecs.push(`Lm: ${fmtL(result.magnetizingInductance)}`)
  if (result.leakageInductance    != null) txSpecs.push(`Llk: ${fmtL(result.leakageInductance)}`)
  return {
    ref:          'T1',
    component:    topology === 'flyback' ? 'Flyback Transformer' : 'Forward Transformer',
    value:        '-',
    rating:       txSpecs.join('; ') || '-',
    pkg:          result.coreType ?? '-',
    manufacturer: '-',
    partNumber:   'Custom wound',
    qty:          1,
    notes:        `fsw: ${fmtHz(spec.fsw)}; core: ${result.coreType ?? 'TBD'}`,
  }
}

/** L1 — Inductor row with Isat, DCR, and Irms ratings. */
function buildL1Row(spec: DesignSpec, result: DesignResult, selected: SelectedComponents): BOMRow {
  const ind  = selected.inductor ?? suggestInductors(result.inductance * 1e6, result.peakCurrent)[0] ?? null
  const irms = result.inductor?.rms_current ?? 0
  return {
    ref:          'L1',
    component:    'Inductor',
    value:        fmtL(result.inductance),
    rating:       `Isat≥${result.peakCurrent.toFixed(1)} A; Irms≥${irms.toFixed(1)} A; DCR≤${maxDcr_mOhm(spec).toFixed(0)} mΩ`,
    pkg:          ind?.size_mm ?? '-',
    manufacturer: ind?.manufacturer ?? '-',
    partNumber:   ind?.part_number ?? '-',
    qty:          1,
    notes:        ind
      ? `DCR: ${ind.dcr_mohm} mΩ; Isat: ${ind.isat_a} A; Irms: ${ind.irms_a} A; ${ind.core_material}`
      : 'No match in database — check requirements',
  }
}

/** Cc — SEPIC coupling capacitor row. */
function buildCcRow(spec: DesignSpec, result: DesignResult): BOMRow {
  return {
    ref: 'Cc', component: 'Capacitor',
    value:  fmtC(result.couplingCapacitance!),
    rating: `V≥${(spec.vinMax * DERATING).toFixed(0)} V; low ESR; film or X7R`,
    pkg: '-', manufacturer: '-', partNumber: '-', qty: 1,
    notes: 'SEPIC coupling capacitor; handles full AC ripple current',
  }
}

/** Cout — Output filter capacitor row. */
function buildCoutRow(spec: DesignSpec, result: DesignResult, selected: SelectedComponents): BOMRow {
  const cap = selected.capacitor ?? suggestCapacitors(result.capacitance * 1e6, spec.vout * 1.5)[0] ?? null
  const coutRating =
    `V≥${(spec.vout * 1.5).toFixed(0)} V; ESR≤${result.output_cap ? fmtR(result.output_cap.esr_max) : '—'}; Irms≥${(result.output_cap?.ripple_current ?? 0).toFixed(2)} A`
  return {
    ref:          'Cout',
    component:    'Capacitor',
    value:        fmtC(result.capacitance),
    rating:       coutRating,
    pkg:          cap?.size ?? '-',
    manufacturer: cap?.manufacturer ?? '-',
    partNumber:   cap?.part_number ?? '-',
    qty:          1,
    notes:        cap
      ? `ESR: ${cap.esr_mohm} mΩ; V: ${cap.voltage_v} V; type: ${cap.type}; Output filter`
      : 'Output filter',
  }
}

/** Cin — Input decoupling capacitor row (charge-balance estimate). */
function buildCinRow(spec: DesignSpec, result: DesignResult): BOMRow {
  const cin_uF = estimateCin_uF(spec, result)
  return {
    ref: 'Cin', component: 'Capacitor', value: `${cin_uF} µF`,
    rating: `V≥${(spec.vinMax * DERATING).toFixed(0)} V; ceramic X5R/X7R`,
    pkg: '-', manufacturer: '-', partNumber: '-', qty: 1,
    notes: 'Input decoupling; estimate — verify with ripple current rating',
  }
}

/** Css — Soft-start capacitor row. */
function buildCssRow(
  topology: string,
  spec: DesignSpec,
  result: DesignResult,
  softStartOpts?: Partial<SoftStartOptions>,
): BOMRow {
  const ss     = designSoftStart(topology, spec, result, undefined, softStartOpts)
  const css_nF = (ss.css * 1e9).toFixed(1)
  return {
    ref: 'Css', component: 'Capacitor', value: `${css_nF} nF`,
    rating: 'X5R or X7R; 10 V min; 0402', pkg: '0402',
    manufacturer: '-', partNumber: '-', qty: 1,
    notes: `Soft-start: tss=${(ss.tss_used * 1e3).toFixed(2)} ms, ` +
           `Iss=${(ss.iss * 1e6).toFixed(0)} µA, Vref=0.8 V. ` +
           `Inrush without SS: ${ss.peak_inrush_a.toFixed(0)} A`,
  }
}

/** Rsense — Current sense resistor row (peak current-mode only, resistor method). */
function buildRsenseRow(result: DesignResult): BOMRow | null {
  if (result.current_sense?.method !== 'resistor') return null
  const cs = result.current_sense
  const notes: string[] = [
    `Vsense: ${(cs.vsense_peak * 1000).toFixed(1)} mV pk`,
    `Power: ${(cs.rsense_power * 1000).toFixed(0)} mW`,
  ]
  if (cs.kelvin_connection_required) notes.push('Kelvin (4-wire) connections required')
  return {
    ref:          'Rsense',
    component:    'Resistor (Current Sense)',
    value:        `${(cs.rsense * 1000).toFixed(2)} mΩ`,
    rating:       `P≥${(cs.rsense_power * 1000).toFixed(0)} mW; low TCR (≤ 50 ppm/°C); ${cs.rsense_package}`,
    pkg:          cs.rsense_package,
    manufacturer: '-',
    partNumber:   '-',
    qty:          1,
    notes:        notes.join('; '),
  }
}

/** Rfb1 + Rfb2 — Feedback voltage divider rows (non-isolated topologies only). */
function buildFeedbackRows(spec: DesignSpec, feedbackOpts?: Partial<FeedbackOptions>): BOMRow[] {
  const fb         = designFeedback(spec.vout, feedbackOpts)
  const seriesLabel = fb.e96_values_used ? 'E96 1%' : 'E24 5%'
  const tolerance   = fb.e96_values_used ? '1' : '5'
  return [
    {
      ref: 'Rfb1', component: 'Resistor', value: fmtResistor(fb.r_top),
      rating: `${seriesLabel}; 0.1 W; tolerance ≤${tolerance} %`, pkg: '0402',
      manufacturer: '-', partNumber: '-', qty: 1,
      notes: `Upper FB divider; Vout→FB. Actual Vout: ${fb.actual_vout.toFixed(4)} V (${fb.vout_error_pct >= 0 ? '+' : ''}${fb.vout_error_pct.toFixed(3)} %)`,
    },
    {
      ref: 'Rfb2', component: 'Resistor', value: fmtResistor(fb.r_bottom),
      rating: `${seriesLabel}; 0.1 W; tolerance ≤${tolerance} %`, pkg: '0402',
      manufacturer: '-', partNumber: '-', qty: 1,
      notes: `Lower FB divider; FB→GND. Vref: ${fb.vref} V; Idiv: ${(fb.divider_current * 1e6).toFixed(0)} µA`,
    },
  ]
}

/** Input EMI filter component rows (when input filter design is available). */
function buildEmiFilterRows(result: DesignResult): BOMRow[] {
  if (!result.input_filter) return []
  return result.input_filter.components.map((c) => ({
    ref: c.ref, component: c.type, value: c.value,
    rating: `V: ${c.voltage_rating}; I: ${c.current_rating}`,
    pkg: '-', manufacturer: '-', partNumber: '-', qty: 1,
    notes: 'EMI input filter',
  }))
}

// ── Public API ────────────────────────────────────────────────────────────────

const CSV_HEADER =
  'Reference,Component,Value,Rating,Package,Manufacturer,Part Number,Quantity,Notes'

const NON_ISOLATED_TOPOLOGIES = new Set(['buck', 'boost', 'buck-boost', 'sepic'])

/**
 * Generate a CSV Bill of Materials for a computed switching-supply design.
 * Rows are ordered by circuit position: switch → rectifier → magnetics →
 * passives → sense/feedback → EMI filter.
 *
 * @param topology     Converter topology identifier
 * @param spec         Design specification
 * @param result       Computed design result
 * @param selected     User-selected or auto-suggested component parts
 * @param feedbackOpts Feedback divider options (Vref, resistor series)
 * @param softStartOpts Soft-start options (mode, tss)
 * @returns CSV string with header row
 */
export function generateBOM(
  topology: string,
  spec: DesignSpec,
  result: DesignResult,
  selected: SelectedComponents,
  feedbackOpts?: Partial<FeedbackOptions>,
  softStartOpts?: Partial<SoftStartOptions>,
): string {
  const { mosfetVds, diodeVr } = voltageStress(topology, spec, result)
  const isSyncMode = spec.rectification === 'synchronous' && NON_ISOLATED_TOPOLOGIES.has(topology)
  const isIsolated = topology === 'flyback' || topology === 'forward'

  const rows: BOMRow[] = []

  rows.push(buildQ1Row(mosfetVds, result, selected))
  rows.push(buildD1Row(topology, spec, mosfetVds, diodeVr, isSyncMode))
  if (topology === 'forward')                                       rows.push(buildD2Row(diodeVr, spec))
  if (isIsolated)                                                   rows.push(buildT1Row(topology, spec, result))
  rows.push(buildL1Row(spec, result, selected))
  if (topology === 'sepic' && result.couplingCapacitance != null)   rows.push(buildCcRow(spec, result))
  rows.push(buildCoutRow(spec, result, selected))
  rows.push(buildCinRow(spec, result))
  rows.push(buildCssRow(topology, spec, result, softStartOpts))

  const rsRow = buildRsenseRow(result)
  if (rsRow) rows.push(rsRow)

  if (!isIsolated) rows.push(...buildFeedbackRows(spec, feedbackOpts))
  rows.push(...buildEmiFilterRows(result))

  return [CSV_HEADER, ...rows.map(rowToCsv)].join('\r\n')
}
