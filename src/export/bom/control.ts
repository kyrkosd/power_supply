// Control-network row builders: soft-start cap, current sense resistor, feedback divider, EMI filter.

import { designFeedback, fmtResistor } from '../../engine/feedback'
import type { FeedbackOptions } from '../../engine/feedback'
import { designSoftStart } from '../../engine/soft-start'
import type { SoftStartOptions } from '../../engine/soft-start'
import type { DesignSpec, DesignResult } from '../../engine/types'
import type { BOMRow } from './types'

const EMPTY_PART = { pkg: '-', manufacturer: '-', partNumber: '-' }

export function buildCssRow(
  topology: string, spec: DesignSpec, result: DesignResult,
  softStartOpts?: Partial<SoftStartOptions>,
): BOMRow {
  const ss     = designSoftStart(topology, spec, result, undefined, softStartOpts)
  const css_nF = (ss.css * 1e9).toFixed(1)
  const note   = `Soft-start: tss=${(ss.tss_used * 1e3).toFixed(2)} ms, ` +
                 `Iss=${(ss.iss * 1e6).toFixed(0)} µA, Vref=0.8 V. ` +
                 `Inrush without SS: ${ss.peak_inrush_a.toFixed(0)} A`
  return {
    ref: 'Css', component: 'Capacitor', value: `${css_nF} nF`,
    rating: 'X5R or X7R; 10 V min; 0402', pkg: '0402',
    manufacturer: '-', partNumber: '-', qty: 1, notes: note,
  }
}

export function buildRsenseRow(result: DesignResult): BOMRow | null {
  if (result.current_sense?.method !== 'resistor') return null
  const cs = result.current_sense
  const notes = [
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
    manufacturer: '-', partNumber: '-', qty: 1,
    notes:        notes.join('; '),
  }
}

interface FeedbackLabels { series: string; tolerance: string }

function feedbackLabels(e96: boolean): FeedbackLabels {
  return e96 ? { series: 'E96 1%', tolerance: '1' } : { series: 'E24 5%', tolerance: '5' }
}

export function buildFeedbackRows(spec: DesignSpec, feedbackOpts?: Partial<FeedbackOptions>): BOMRow[] {
  const fb = designFeedback(spec.vout, feedbackOpts)
  const { series, tolerance } = feedbackLabels(fb.e96_values_used)
  const errSign = fb.vout_error_pct >= 0 ? '+' : ''
  return [
    {
      ref: 'Rfb1', component: 'Resistor', value: fmtResistor(fb.r_top),
      rating: `${series}; 0.1 W; tolerance ≤${tolerance} %`, pkg: '0402',
      manufacturer: '-', partNumber: '-', qty: 1,
      notes: `Upper FB divider; Vout→FB. Actual Vout: ${fb.actual_vout.toFixed(4)} V (${errSign}${fb.vout_error_pct.toFixed(3)} %)`,
    },
    {
      ref: 'Rfb2', component: 'Resistor', value: fmtResistor(fb.r_bottom),
      rating: `${series}; 0.1 W; tolerance ≤${tolerance} %`, pkg: '0402',
      manufacturer: '-', partNumber: '-', qty: 1,
      notes: `Lower FB divider; FB→GND. Vref: ${fb.vref} V; Idiv: ${(fb.divider_current * 1e6).toFixed(0)} µA`,
    },
  ]
}

export function buildEmiFilterRows(result: DesignResult): BOMRow[] {
  if (!result.input_filter) return []
  return result.input_filter.components.map((c) => ({
    ref: c.ref, component: c.type, value: c.value,
    rating: `V: ${c.voltage_rating}; I: ${c.current_rating}`,
    ...EMPTY_PART,
    qty: 1, notes: 'EMI input filter',
  }))
}
