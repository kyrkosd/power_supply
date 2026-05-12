import type { InductorData } from './component-selector'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaturationResult {
  i_peak:           number        // A — peak inductor current from design
  i_sat:            number | null // A — datasheet saturation current; null when no part selected
  margin_pct:       number | null // % — (Isat − Ipeak) / Isat × 100; null when no part selected
  estimated_B_peak: number        // T — estimated peak flux density (linear B ∝ I model)
  B_sat_material:   number        // T — assumed saturation flux density for default core material
  is_saturated:     boolean
  warning:          string | null
}

// Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., Table 13.2
const B_SAT_FERRITE = 0.30  // T — MnZn ferrite at 100 °C (conservative)

// ── Branch helpers ────────────────────────────────────────────────────────────

/**
 * Saturation check against a specific part's datasheet I_sat.
 * Linear B ∝ I approximation: B_peak / B_sat = I_peak / I_sat.
 * Warns at full saturation and when headroom falls below 20 %.
 */
function checkWithPart(I_peak: number, inductor: InductorData, B_sat: number): SaturationResult {
  const i_sat        = inductor.isat_a
  const margin_pct   = (i_sat - I_peak) / i_sat * 100
  const is_saturated = I_peak >= i_sat
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

/**
 * Saturation heuristic when no specific part is selected.
 * Typical ferrite SMD inductors saturate at roughly 1.3 × I_avg (equivalent to
 * a ripple ratio ≤ 0.60 for a buck output inductor).
 * Erickson & Maksimovic §13.1 — design constraint B_peak < B_sat.
 */
function checkWithHeuristic(I_peak: number, I_avg: number, B_sat: number): SaturationResult {
  const i_sat_heuristic  = 1.3 * Math.max(Math.abs(I_avg), 0.001)
  const is_saturated     = I_peak > i_sat_heuristic
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
    i_peak: I_peak, i_sat: null, margin_pct: null,
    estimated_B_peak, B_sat_material: B_sat, is_saturated, warning,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether the inductor is at risk of core saturation.
 *
 * - **Part provided** — compares I_peak against the datasheet I_sat; warns
 *   when margin falls below 20 % or saturation is exceeded.
 * - **No part** — applies a heuristic: typical ferrite SMD inductors saturate
 *   at ≈ 1.3 × I_avg; warns when I_peak exceeds this threshold or flux
 *   density exceeds 80 % of B_sat.
 *
 * @param I_peak   Peak current seen by the inductor (A).
 * @param I_avg    Average DC inductor current (A) — used only by the heuristic branch.
 * @param inductor Optional database entry; when present, uses the actual I_sat rating.
 */
export function checkSaturation(
  I_peak: number,
  I_avg: number,
  inductor?: InductorData | null,
): SaturationResult {
  return inductor
    ? checkWithPart(I_peak, inductor, B_SAT_FERRITE)
    : checkWithHeuristic(I_peak, I_avg, B_SAT_FERRITE)
}
