// References:
//   TI SLVA801  — Startup behaviour and soft-start in switching regulators
//   Erickson & Maksimovic 3rd ed. §10.1 — Monotonic startup, pre-biased loads
//   ON Semiconductor AND9135 — Soft-start capacitor sizing
//   TI SLVA236A eq. 2 — Inductor DCR-limited inrush current
import type { DesignSpec, DesignResult } from './types'
import type { InductorData } from './component-selector'
import { computeRecommendedTss, ISOLATED_TOPOLOGIES } from './soft-start/tss'
import { computeDcrInrush } from './soft-start/inrush'
import { buildSoftStartWarnings } from './soft-start/warnings'

export interface SoftStartOptions {
  tss_s: number
  iss_ua: number
  auto_tss: boolean
}

export interface SoftStartResult {
  recommended_tss: number
  tss_used: number
  css: number
  iss: number
  peak_inrush_a: number
  peak_inrush_with_ss: number
  output_monotonic: boolean
  pre_bias_safe: boolean
  warnings: string[]
}

export const DEFAULT_SOFT_START_OPTIONS: SoftStartOptions = {
  tss_s: 0.005,
  iss_ua: 10,
  auto_tss: true,
}

// Size the soft-start capacitor and estimate inrush currents.
// References: TI SLVA801, Erickson §10.1, ON Semi AND9135, TI SLVA236A.
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

  return { recommended_tss, tss_used, css, iss, peak_inrush_a, peak_inrush_with_ss, output_monotonic, pre_bias_safe, warnings }
}
