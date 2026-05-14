// TI SLVA477B eq. 3: Vout = Vref × (1 + R_top / R_bottom).
import { E96_SERIES, E24_SERIES, snapToSeries } from './e-series'
import type { FeedbackOptions, FeedbackResult } from './types'

export function computeDesign(vout: number, opts: FeedbackOptions): FeedbackResult {
  const { vref, divider_current_ua, prefer_e24 } = opts
  const I_div  = divider_current_ua * 1e-6
  const series = prefer_e24 ? E24_SERIES : E96_SERIES

  const r_bottom_ideal = vref / I_div
  const r_top_ideal    = r_bottom_ideal * (vout / vref - 1)
  const r_bottom = snapToSeries(r_bottom_ideal, series)
  const r_top    = r_top_ideal > 0 ? snapToSeries(r_top_ideal, series) : series[0]

  const actual_vout     = vref * (1 + r_top / r_bottom)
  const divider_current = vref / r_bottom

  return {
    r_top, r_bottom, vref, actual_vout,
    vout_error_pct:   ((actual_vout - vout) / vout) * 100,
    divider_current,
    power_dissipated: actual_vout * divider_current,
    e96_values_used:  !prefer_e24,
  }
}
