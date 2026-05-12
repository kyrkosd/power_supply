// References:
//   TI SLVA801  — Startup behaviour and soft-start in switching regulators
//   Erickson & Maksimovic 3rd ed. §10.1 — Monotonic startup, pre-biased loads
//   ON Semiconductor AND9135 — Soft-start capacitor sizing
//   TI SLVA236A eq. 2 — Inductor DCR-limited inrush current
import type { DesignSpec, DesignResult } from './types'
import type { InductorData } from './component-selector'

export interface SoftStartOptions {
  tss_s: number      // s  — user-specified soft-start time (used when auto_tss = false)
  iss_ua: number     // µA — IC internal soft-start charge current (default 10 µA)
  auto_tss: boolean  // derive tss from the design (ignores tss_s)
}

export interface SoftStartResult {
  recommended_tss: number      // s — from Cout×Vout/Iout×10, clamped to [1 ms, 50 ms]
  tss_used: number             // s — recommended if auto_tss, else user value
  css: number                  // F — soft-start capacitor (Css = Iss × tss / Vref)
  iss: number                  // A — soft-start charge current
  peak_inrush_a: number        // A — worst-case inrush without soft-start (DCR-limited)
  peak_inrush_with_ss: number  // A — peak demand with soft-start active
  output_monotonic: boolean    // true when fc > 1/tss (loop tracks the reference ramp)
  pre_bias_safe: boolean       // false for isolated topologies
  warnings: string[]
}

export const DEFAULT_SOFT_START_OPTIONS: SoftStartOptions = {
  tss_s: 0.005,
  iss_ua: 10,
  auto_tss: true,
}

const ISOLATED_TOPOLOGIES = new Set(['flyback', 'forward'])

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Auto-derived soft-start time from the output filter time constant.
 * TI SLVA801 §3 — ten output time constants; clamped to [1 ms, 50 ms].
 */
function computeRecommendedTss(result: DesignResult, spec: DesignSpec): number {
  return Math.max(0.001, Math.min(0.050,
    (result.capacitance * spec.vout * 10) / spec.iout,
  ))
}

/**
 * DCR-limited inrush current estimate at power-on.
 * TI SLVA236A eq. 2: I_inrush = Vin / DCR.
 * Falls back to ~10 mΩ/µH heuristic when no inductor is selected.
 */
function computeDcrInrush(spec: DesignSpec, result: DesignResult, inductor?: InductorData | null) {
  const dcr_known = !!(inductor && inductor.dcr_mohm > 0)
  const dcr_ohm   = dcr_known
    ? inductor!.dcr_mohm * 1e-3
    : Math.max(0.010, result.inductance * 1e4)
  return { dcr_known, dcr_ohm, peak_inrush_a: spec.vinMax / dcr_ohm }
}

/** Collect soft-start design warnings. */
function buildSoftStartWarnings(
  spec: DesignSpec,
  topology: string,
  tss_used: number,
  dcr_known: boolean,
  dcr_ohm: number,
  peak_inrush_a: number,
  output_monotonic: boolean,
  fc_est: number,
): string[] {
  const warnings: string[] = []

  if (!dcr_known) {
    warnings.push(
      `DCR estimated (~${(dcr_ohm * 1e3).toFixed(0)} mΩ) — select an inductor for accurate inrush estimation.`,
    )
  }
  if (peak_inrush_a > 10 * spec.iout) {
    warnings.push(
      `Peak inrush without soft-start (${peak_inrush_a.toFixed(0)} A) is more than ` +
      `10× rated current. Consider an NTC thermistor or pre-charge circuit.`,
    )
  }
  if (!output_monotonic) {
    warnings.push(
      `Startup may not be monotonic: estimated loop bandwidth (~${(fc_est / 1000).toFixed(0)} kHz) ` +
      `is below the soft-start ramp rate (${(1 / tss_used).toFixed(0)} Hz). ` +
      `Increase tss or verify loop gain.`,
    )
  }
  if (ISOLATED_TOPOLOGIES.has(topology)) {
    warnings.push(
      `Pre-biased startup for isolated topologies requires secondary-side detection ` +
      `(TL431 output-voltage sensing). Basic primary-side soft-start is insufficient.`,
    )
  }

  return warnings
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Size the soft-start capacitor and estimate inrush currents.
 * References: TI SLVA801, Erickson §10.1, ON Semi AND9135, TI SLVA236A.
 */
export function designSoftStart(
  topology: string,
  spec: DesignSpec,
  result: DesignResult,
  inductor?: InductorData | null,
  options: Partial<SoftStartOptions> = {},
): SoftStartResult {
  const opts: SoftStartOptions = { ...DEFAULT_SOFT_START_OPTIONS, ...options }

  const recommended_tss = computeRecommendedTss(result, spec)
  const tss_used = opts.auto_tss
    ? recommended_tss
    : Math.max(0.0005, Math.min(0.050, opts.tss_s))

  const iss = opts.iss_ua * 1e-6
  // ON Semiconductor AND9135: Css = Iss × tss / Vref (Vref = 0.8 V default)
  const css = (iss * tss_used) / 0.8

  const { dcr_known, dcr_ohm, peak_inrush_a } = computeDcrInrush(spec, result, inductor)

  // Erickson §10.1 — capacitor charging current during soft-start ramp
  const peak_inrush_with_ss = (result.capacitance * spec.vout) / tss_used + spec.iout

  // Monotonic startup: fc must exceed 1/tss; fc ≈ fsw/10 (TI SLVA477)
  const fc_est           = spec.fsw / 10
  const output_monotonic = fc_est > (1 / tss_used)
  const pre_bias_safe    = !ISOLATED_TOPOLOGIES.has(topology)

  const warnings = buildSoftStartWarnings(
    spec, topology, tss_used, dcr_known, dcr_ohm, peak_inrush_a, output_monotonic, fc_est,
  )

  return {
    recommended_tss,
    tss_used,
    css,
    iss,
    peak_inrush_a,
    peak_inrush_with_ss,
    output_monotonic,
    pre_bias_safe,
    warnings,
  }
}
