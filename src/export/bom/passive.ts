// Passive-component (inductor, output cap, input cap, coupling cap) row builders.

import { suggestInductors, suggestCapacitors } from '../../engine/component-selector'
import type { SelectedComponents } from '../../engine/component-selector'
import type { DesignSpec, DesignResult } from '../../engine/types'
import { fmtL, fmtC, fmtR } from '../format-utils'
import { DERATING, type BOMRow } from './types'

const EMPTY_PART = { pkg: '-', manufacturer: '-', partNumber: '-' }

/** Allow ≤ 1 % of Vout to drop across DCR at full load. */
function maxDcr_mOhm(spec: DesignSpec): number {
  return ((spec.vout * 0.01) / spec.iout) * 1e3
}

/** Cin ≥ Ipeak·D / (fsw·ΔVin_pp); ΔVin_pp = 2 % of Vin_min. */
function estimateCin_uF(spec: DesignSpec, result: DesignResult): number {
  const deltaVin = spec.vinMin * 0.02
  return Math.max(10, Math.ceil((result.peakCurrent * result.dutyCycle) / (spec.fsw * deltaVin) * 1e6))
}

export function buildL1Row(spec: DesignSpec, result: DesignResult, selected: SelectedComponents): BOMRow {
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

export function buildCcRow(spec: DesignSpec, result: DesignResult): BOMRow {
  return {
    ref:    'Cc', component: 'Capacitor',
    value:  fmtC(result.couplingCapacitance!),
    rating: `V≥${(spec.vinMax * DERATING).toFixed(0)} V; low ESR; film or X7R`,
    ...EMPTY_PART,
    qty: 1, notes: 'SEPIC coupling capacitor; handles full AC ripple current',
  }
}

function coutRatingString(spec: DesignSpec, result: DesignResult): string {
  const esr  = result.output_cap ? fmtR(result.output_cap.esr_max) : '—'
  const irms = (result.output_cap?.ripple_current ?? 0).toFixed(2)
  return `V≥${(spec.vout * 1.5).toFixed(0)} V; ESR≤${esr}; Irms≥${irms} A`
}

export function buildCoutRow(spec: DesignSpec, result: DesignResult, selected: SelectedComponents): BOMRow {
  const cap = selected.capacitor ?? suggestCapacitors(result.capacitance * 1e6, spec.vout * 1.5)[0] ?? null
  return {
    ref:          'Cout',
    component:    'Capacitor',
    value:        fmtC(result.capacitance),
    rating:       coutRatingString(spec, result),
    pkg:          cap?.size ?? '-',
    manufacturer: cap?.manufacturer ?? '-',
    partNumber:   cap?.part_number ?? '-',
    qty:          1,
    notes:        cap
      ? `ESR: ${cap.esr_mohm} mΩ; V: ${cap.voltage_v} V; type: ${cap.type}; Output filter`
      : 'Output filter',
  }
}

export function buildCinRow(spec: DesignSpec, result: DesignResult): BOMRow {
  const cin_uF = estimateCin_uF(spec, result)
  return {
    ref:    'Cin', component: 'Capacitor', value: `${cin_uF} µF`,
    rating: `V≥${(spec.vinMax * DERATING).toFixed(0)} V; ceramic X5R/X7R`,
    ...EMPTY_PART,
    qty: 1, notes: 'Input decoupling; estimate — verify with ripple current rating',
  }
}
