import type { InductorData } from './component-selector'

export interface SaturationResult {
  i_peak: number              // A — peak inductor current from design
  i_sat: number | null        // A — datasheet saturation current; null when no part selected
  margin_pct: number | null   // % — (Isat − Ipeak) / Isat × 100; null when no part selected
  estimated_B_peak: number    // T — estimated peak flux density (proportional model)
  B_sat_material: number      // T — assumed saturation flux density for default core material
  is_saturated: boolean
  warning: string | null
}

// Saturation flux densities by core material.
// Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., Table 13.2
const B_SAT_FERRITE = 0.30  // T — MnZn ferrite at 100 °C (conservative)

/**
 * Checks whether the inductor is at risk of core saturation.
 *
 * Two operating modes:
 * 1. **Part selected** (`inductor` provided) — compares I_peak directly against the
 *    datasheet Isat rating.  A linear B ∝ I approximation gives estimated_B_peak.
 * 2. **No part** — uses a heuristic: typical ferrite SMD inductors saturate at
 *    roughly 1.3 × I_avg for the given inductance value.  Warns when I_peak > 1.3 × I_avg
 *    (equivalent to ripple ratio > 0.60 for a buck output inductor).
 *    Erickson & Maksimovic §13.1 discusses the design constraint B_peak < B_sat.
 *
 * @param I_peak   — peak current seen by the inductor, A (SI)
 * @param I_avg    — average (DC) inductor current, A — used only for the no-part heuristic
 * @param inductor — optional database entry; when present, uses actual Isat rating
 */
export function checkSaturation(
  I_peak: number,
  I_avg: number,
  inductor?: InductorData | null,
): SaturationResult {
  const B_sat = B_SAT_FERRITE

  if (inductor) {
    // ── Specific part: compare against datasheet Isat ────────────────────────
    const i_sat     = inductor.isat_a
    const margin_pct = (i_sat - I_peak) / i_sat * 100
    const is_saturated = I_peak >= i_sat
    // Linear B ∝ I: B_peak / B_sat = I_peak / I_sat
    const estimated_B_peak = B_sat * I_peak / i_sat

    let warning: string | null = null
    if (is_saturated) {
      warning =
        `Inductor is saturated! Peak current (${I_peak.toFixed(2)} A) exceeds ` +
        `saturation current (${i_sat.toFixed(2)} A). The converter will not operate correctly.`
    } else if (margin_pct < 20) {
      warning =
        `Inductor peak current (${I_peak.toFixed(2)} A) is within ` +
        `${margin_pct.toFixed(0)} % of saturation rating (${i_sat.toFixed(2)} A). ` +
        `Choose a larger inductor or reduce ripple ratio.`
    }

    return { i_peak: I_peak, i_sat, margin_pct, estimated_B_peak, B_sat_material: B_sat, is_saturated, warning }
  }

  // ── No specific part: heuristic for a typical ferrite SMD inductor ────────
  // A well-sized inductor has Isat ≈ 1.3 × I_avg (equivalent to ripple ratio ≤ 0.60).
  const i_sat_heuristic = 1.3 * Math.max(Math.abs(I_avg), 0.001)
  const is_saturated    = I_peak > i_sat_heuristic
  const estimated_B_peak = B_sat * I_peak / i_sat_heuristic

  let warning: string | null = null
  if (is_saturated) {
    warning =
      `Inductor may be undersized: peak current (${I_peak.toFixed(2)} A) exceeds ` +
      `typical Isat for this operating point (~${i_sat_heuristic.toFixed(2)} A). ` +
      `Verify datasheet Isat ≥ ${I_peak.toFixed(2)} A or reduce ripple ratio.`
  } else if (estimated_B_peak > B_sat * 0.80) {
    warning =
      `Inductor operating near saturation (est. B ≈ ${(estimated_B_peak / B_sat * 100).toFixed(0)} % of Bsat). ` +
      `Confirm datasheet Isat > ${I_peak.toFixed(2)} A with the selected part.`
  }

  return {
    i_peak: I_peak,
    i_sat: null,
    margin_pct: null,
    estimated_B_peak,
    B_sat_material: B_sat,
    is_saturated,
    warning,
  }
}
