// References:
//   TI SLVA477B eq. 3 — Vout = Vref × (1 + R_top / R_bottom)
//   IEC 60063:2015    — preferred number series E24, E96
//   Analog Devices MT-088 — resistor selection for precision dividers
import e96Data from '../data/e96-values.json'

export interface FeedbackOptions {
  vref: number               // V   — reference voltage (default 0.8 V)
  divider_current_ua: number // µA  — bias current through divider (default 100 µA)
  prefer_e24: boolean        // use E24 instead of E96 (default false)
}

export interface FeedbackResult {
  r_top: number             // Ω — upper resistor (Vout to FB pin)
  r_bottom: number          // Ω — lower resistor (FB pin to GND)
  vref: number              // V — reference voltage used
  actual_vout: number       // V — Vout with snapped standard values
  vout_error_pct: number    // % — (actual − target) / target × 100
  divider_current: number   // A — DC current through the divider
  power_dissipated: number  // W — total power in both resistors
  e96_values_used: boolean  // true → E96 values, false → E24
}

export const DEFAULT_FEEDBACK_OPTIONS: FeedbackOptions = {
  vref: 0.8,
  divider_current_ua: 100,
  prefer_e24: false,
}

const E96_SERIES = e96Data.e96 as number[]
const E24_SERIES = e96Data.e24 as number[]

/**
 * Binary search for the nearest value in a sorted log-spaced series.
 * Log-domain tie-break gives the true nearest neighbour for IEC 60063 E-series.
 */
function snapToSeries(value: number, series: number[]): number {
  if (value <= series[0]) return series[0]
  if (value >= series[series.length - 1]) return series[series.length - 1]

  let lo = 0
  let hi = series.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (series[mid] < value) lo = mid + 1
    else hi = mid
  }
  const above = series[lo]
  const below = series[lo - 1]
  return Math.abs(Math.log(value / below)) <= Math.abs(Math.log(above / value))
    ? below
    : above
}

/** Format resistance in engineering notation (Ω / kΩ / MΩ). */
export function fmtResistor(ohm: number): string {
  if (ohm >= 1_000_000) return `${(ohm / 1_000_000).toPrecision(3)} MΩ`
  if (ohm >= 1_000)     return `${(ohm / 1_000).toPrecision(3)} kΩ`
  return `${ohm.toPrecision(3)} Ω`
}

/** Compute ideal (non-rounded) resistor values — TI SLVA477B eq. 3. */
function computeIdealResistors(vout: number, vref: number, I_div: number) {
  const r_bottom_ideal = vref / I_div
  const r_top_ideal    = r_bottom_ideal * (vout / vref - 1)
  return { r_bottom_ideal, r_top_ideal }
}

/** Snap ideal resistor values to the nearest standard series value. */
function snapResistors(r_top_ideal: number, r_bottom_ideal: number, series: number[]) {
  const r_bottom = snapToSeries(r_bottom_ideal, series)
  const r_top    = r_top_ideal > 0 ? snapToSeries(r_top_ideal, series) : series[0]
  return { r_top, r_bottom }
}

/**
 * Design the feedback resistor divider for output voltage regulation.
 * TI SLVA477B eq. 3: Vout = Vref × (1 + R_top / R_bottom).
 * Both resistors are snapped to the nearest E96 (or E24) standard value.
 */
export function designFeedback(
  vout: number,
  options: Partial<FeedbackOptions> = {},
): FeedbackResult {
  const opts: FeedbackOptions = { ...DEFAULT_FEEDBACK_OPTIONS, ...options }
  const { vref, divider_current_ua, prefer_e24 } = opts
  const I_div  = divider_current_ua * 1e-6
  const series = prefer_e24 ? E24_SERIES : E96_SERIES

  const { r_bottom_ideal, r_top_ideal } = computeIdealResistors(vout, vref, I_div)
  const { r_top, r_bottom }             = snapResistors(r_top_ideal, r_bottom_ideal, series)

  const actual_vout      = vref * (1 + r_top / r_bottom)
  const vout_error_pct   = ((actual_vout - vout) / vout) * 100
  const divider_current  = vref / r_bottom
  // Power across the full divider string: P = Vout × I_div
  const power_dissipated = actual_vout * divider_current

  return {
    r_top,
    r_bottom,
    vref,
    actual_vout,
    vout_error_pct,
    divider_current,
    power_dissipated,
    e96_values_used: !prefer_e24,
  }
}
