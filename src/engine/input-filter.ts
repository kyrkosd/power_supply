// Input EMI filter designer for switching power supplies.
//
// References:
//   Middlebrook, R.D. "Input Filter Considerations in Design and Application of
//     Switching Regulators" IEEE IAS 1976 — negative impedance stability criterion
//   TI SLYT636 — EMI Filter Design for Power Electronics
//   Erickson & Maksimovic §10.1 — Filter Design / Damping
//   IEC 60384-14 — X and Y capacitor safety classes
//   Würth Elektronik ANP008e — Common-mode choke design guidelines

import type { DesignSpec, DesignResult } from './types'
import type { EMIResult } from './topologies/types'

// ── Public types ──────────────────────────────────────────────────────────────

export interface InputFilterOptions {
  enabled: boolean
  // Override attenuation target (dB). 0 = auto from EMI result.
  attenuation_override_db: number
  // Common-mode choke inductance (H). 0 = auto select.
  cm_choke_h: number
}

export const DEFAULT_INPUT_FILTER_OPTIONS: InputFilterOptions = {
  enabled: false,
  attenuation_override_db: 0,
  cm_choke_h: 0,
}

export interface FilterComponent {
  type: string
  value: string
  voltage_rating: string
  current_rating: string
  ref: string
}

export interface InputFilterResult {
  // DM filter
  dm_inductor: number       // H
  dm_capacitor: number      // F
  // CM filter
  cm_choke: number          // H
  x_capacitor: number       // F
  y_capacitors: number      // F — per capacitor; two required (line-to-GND each)
  // Damping network (Rd + Cd in parallel with dm_capacitor)
  damping_resistor: number  // Ω
  damping_capacitor: number // F
  // Performance
  filter_resonant_freq: number         // Hz
  filter_attenuation_at_fsw: number   // dB — 40 dB/dec roll-off from resonance
  required_attenuation_db: number      // dB — from EMI margin
  // Stability (Middlebrook criterion)
  middlebrook_stable: boolean
  negative_input_impedance: number     // Ω — magnitude of converter negative-R input
  filter_output_impedance_at_resonance: number  // Ω
  stability_margin_db: number          // dB — positive = stable
  // Filter inductor loss (DCR at full load)
  filter_inductor_loss_w: number
  // Component BOM
  components: FilterComponent[]
  warnings: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// Select the nearest value from E12 series for inductors / capacitors.
const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]

function nearestE12(value: number): number {
  if (value <= 0) return E12[0]
  const exp = Math.floor(Math.log10(value))
  const mantissa = value / Math.pow(10, exp)
  let best = E12[0]
  let bestErr = Math.abs(mantissa - best)
  for (const v of E12) {
    const err = Math.abs(mantissa - v)
    if (err < bestErr) { best = v; bestErr = err }
  }
  return best * Math.pow(10, exp)
}

function fmtH(h: number): string {
  if (h >= 1e-3) return `${(h * 1e3).toFixed(2)} mH`
  if (h >= 1e-6) return `${(h * 1e6).toFixed(1)} µH`
  return `${(h * 1e9).toFixed(1)} nH`
}

function fmtF(f: number): string {
  if (f >= 1e-6) return `${(f * 1e6).toFixed(2)} µF`
  if (f >= 1e-9) return `${(f * 1e9).toFixed(1)} nF`
  return `${(f * 1e12).toFixed(1)} pF`
}

function fmtR(r: number): string {
  if (r >= 1e3) return `${(r / 1e3).toFixed(1)} kΩ`
  return `${r.toFixed(2)} Ω`
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Design an EMI input filter for a switching converter.
 *
 * Design flow:
 *  1. Determine required DM attenuation from EMI worst-case margin.
 *  2. Size Lf / Cf for a second-order LC with resonance at fsw/10.
 *  3. Add damping (Rd+Cd) to prevent filter–converter resonance.
 *  4. Check Middlebrook criterion: |Zout_filter| < |Zin_converter|.
 *  5. Size CM choke and Y-caps per safety limits.
 *
 * @param spec    DesignSpec (vinMin, vinMax, vout, iout, fsw)
 * @param result  DesignResult (peakCurrent, dutyCycle, inductance, losses)
 * @param emi     EMIResult from estimateEMI()
 * @param opts    InputFilterOptions (override attenuation, CM choke, enable)
 */
export function designInputFilter(
  _topology: string,
  spec: DesignSpec,
  result: DesignResult,
  emi: EMIResult,
  opts: InputFilterOptions = DEFAULT_INPUT_FILTER_OPTIONS,
): InputFilterResult {
  const warnings: string[] = []
  const fsw = spec.fsw

  // ── 1. Required attenuation ───────────────────────────────────────────────
  // If EMI passes with margin, we still design a filter with at least 20 dB
  // (good practice for conducted EMI even when harmonics look OK).
  // If EMI fails, we need |worst_margin| + 6 dB safety margin.
  let required_attenuation_db: number
  if (opts.attenuation_override_db > 0) {
    required_attenuation_db = opts.attenuation_override_db
  } else if (emi.worst_margin_db < 0) {
    // worst_margin_db is negative when limit is exceeded
    required_attenuation_db = Math.abs(emi.worst_margin_db) + 6
  } else {
    // Even when compliant, a minimum 20 dB filter is standard practice
    required_attenuation_db = Math.max(20, 6 - emi.worst_margin_db)
  }

  // ── 2. DM filter: Lf and Cf ───────────────────────────────────────────────
  // Target resonance: f_res = fsw / 10 gives 40 dB/dec roll-off well below fsw.
  // Minimum f_res ensures we don't interfere with line frequency (> 1 kHz min).
  // Reference: Erickson §10.1 — choose f_res << fsw
  const f_res_target = Math.max(1000, fsw / 10)

  // Characteristic impedance Z0 = sqrt(Lf/Cf). Choose Z0 ≈ source impedance
  // seen by the filter input. Practical choice: Z0 ≈ Vin / (2 × Ipeak) — a
  // balanced split between L and C impedances at resonance.
  const z0 = Math.max(1, spec.vinMin / (2 * Math.max(result.peakCurrent, 0.1)))

  // Lf = Z0 / (2π × f_res), Cf = 1 / (Z0 × 2π × f_res)
  // Reference: Erickson eq. 10.4
  const omega_res = 2 * Math.PI * f_res_target
  const lf_raw = z0 / omega_res
  const cf_raw = 1 / (z0 * omega_res)

  const dm_inductor  = nearestE12(lf_raw)
  const dm_capacitor = nearestE12(cf_raw)

  // Actual resonant frequency with snapped values
  const filter_resonant_freq = 1 / (2 * Math.PI * Math.sqrt(dm_inductor * dm_capacitor))

  // Attenuation at fsw: 40 dB/dec for second-order LC above resonance
  // Att = 40 × log10(fsw / f_res)  (Reference: TI SLYT636 eq. 1)
  const filter_attenuation_at_fsw = 40 * Math.log10(Math.max(fsw / filter_resonant_freq, 1))

  if (filter_attenuation_at_fsw < required_attenuation_db) {
    warnings.push(
      `Filter provides ${filter_attenuation_at_fsw.toFixed(0)} dB at fsw but ${required_attenuation_db.toFixed(0)} dB is required. ` +
      `Reduce f_res (increase L and C) or add a second filter stage.`,
    )
  }

  // ── 3. Damping network (Erickson §10.2) ─────────────────────────────────
  // Without damping the LC resonance can interact with the converter's
  // negative input impedance and cause oscillation (Middlebrook 1976).
  // Add Rd + Cd in parallel with Cf.
  // Rd = Z0 / 3 → Q ≈ 1, critically damped  (Erickson eq. 10.18)
  // Cd = 4 × Cf ensures Cd dominates at resonance and Rd doesn't short Cf at DC
  const damping_resistor  = z0 / 3
  const damping_capacitor = nearestE12(4 * dm_capacitor)

  // ── 4. Middlebrook stability criterion ───────────────────────────────────
  // Converter negative input impedance (CCM): Zin = -Vin² / Pout
  // Magnitude |Zin| = Vin² / (Vout × Iout × η)
  // Reference: Middlebrook IEEE IAS 1976 eq. 3
  const pout = spec.vout * spec.iout
  const eff  = result.efficiency ?? spec.efficiency
  const negative_input_impedance = (spec.vinMin * spec.vinMin) / (pout / eff)

  // Filter output impedance at resonance (without damping): Zout ≈ Z0 (Q-peaked)
  // With Rd||Cd damping, Zout_peak ≈ Rd = Z0/3
  const filter_output_impedance_at_resonance = damping_resistor

  // Stability condition: |Zout| < |Zin| / 3  (additional 9.5 dB safety factor)
  // Reference: Erickson §10.3 — tightened Middlebrook criterion
  const stability_ratio = filter_output_impedance_at_resonance / negative_input_impedance
  const stability_margin_db = 20 * Math.log10(negative_input_impedance / (3 * filter_output_impedance_at_resonance))
  const middlebrook_stable = stability_ratio < 1 / 3

  if (!middlebrook_stable) {
    warnings.push(
      `Middlebrook stability criterion violated: filter output impedance (${fmtR(filter_output_impedance_at_resonance)}) ` +
      `≥ Zin/3 (${fmtR(negative_input_impedance / 3)}). ` +
      `Increase damping resistor or reduce filter inductance.`,
    )
  } else if (stability_margin_db < 6) {
    warnings.push(
      `Middlebrook margin is only ${stability_margin_db.toFixed(1)} dB. Recommend > 6 dB. ` +
      `Consider larger Rd or a lower filter inductance.`,
    )
  }

  // ── 5. CM choke and Y-capacitors ─────────────────────────────────────────
  // Y capacitors are safety-rated (IEC 60384-14): max 4.7 nF line-to-PE.
  // Standard CM filter: L_cm ≈ 1–10 mH, Cy = 2.2 nF (common value within limit).
  // Reference: Würth ANP008e §3
  const cm_choke = opts.cm_choke_h > 0
    ? opts.cm_choke_h
    : nearestE12(Math.max(1e-3, 1 / (2 * Math.PI * Math.max(emi.first_failing_harmonic ?? fsw, fsw) * 2.2e-9 * 4)))

  // Clamp CM choke to practical range: 1 mH – 47 mH
  const cm_choke_clamped = Math.min(47e-3, Math.max(1e-3, cm_choke))

  // X capacitor: across AC line, Class X2 (250 Vrms min), sized at ~100–470 nF
  // Standard design: Cx = 1 / (2π × (mains_freq ≈ 50Hz) × Z_source) ≈ 100 nF
  const x_capacitor = nearestE12(100e-9)

  // Y capacitors: 2.2 nF is the de facto standard within IEC 60384-14 safety limit
  const y_capacitors = 2.2e-9

  // ── 6. Filter inductor loss estimate ─────────────────────────────────────
  // DCR estimate: typical power filter inductor has DCR ≈ Z0 / 100 (conservative)
  const dcr_estimate = Math.max(0.005, z0 / 100)
  const filter_inductor_loss_w = result.peakCurrent * result.peakCurrent * dcr_estimate

  // ── 7. Build component list ───────────────────────────────────────────────
  const vin_max_str = `${spec.vinMax.toFixed(0)} V`
  const vin_rat_str = `${(spec.vinMax * 1.5).toFixed(0)} V`  // 50 % derating
  const iout_str    = `${result.peakCurrent.toFixed(1)} A`

  const components: FilterComponent[] = [
    {
      ref: 'Lf',
      type: 'DM Inductor',
      value: fmtH(dm_inductor),
      voltage_rating: vin_rat_str,
      current_rating: iout_str,
    },
    {
      ref: 'Cf',
      type: 'DM Capacitor (X2)',
      value: fmtF(dm_capacitor),
      voltage_rating: vin_rat_str,
      current_rating: `Irms ≥ ${(result.peakCurrent * 0.3).toFixed(1)} A`,
    },
    {
      ref: 'Rd',
      type: 'Damping Resistor',
      value: fmtR(damping_resistor),
      voltage_rating: vin_rat_str,
      current_rating: iout_str,
    },
    {
      ref: 'Cd',
      type: 'Damping Capacitor (X2)',
      value: fmtF(damping_capacitor),
      voltage_rating: vin_rat_str,
      current_rating: `Irms ≥ ${(result.peakCurrent * 0.3).toFixed(1)} A`,
    },
    {
      ref: 'Lcm',
      type: 'CM Choke',
      value: fmtH(cm_choke_clamped),
      voltage_rating: vin_max_str,
      current_rating: iout_str,
    },
    {
      ref: 'Cx',
      type: 'X2 Safety Capacitor',
      value: fmtF(x_capacitor),
      voltage_rating: '275 Vrms (X2)',
      current_rating: '—',
    },
    {
      ref: 'Cy1',
      type: 'Y2 Safety Capacitor',
      value: fmtF(y_capacitors),
      voltage_rating: '250 Vrms (Y2)',
      current_rating: '—',
    },
    {
      ref: 'Cy2',
      type: 'Y2 Safety Capacitor',
      value: fmtF(y_capacitors),
      voltage_rating: '250 Vrms (Y2)',
      current_rating: '—',
    },
  ]

  // ── Warnings ──────────────────────────────────────────────────────────────
  if (filter_resonant_freq < 500) {
    warnings.push(
      `Filter resonance at ${filter_resonant_freq.toFixed(0)} Hz is close to line frequency. ` +
      `Reduce filter component values.`,
    )
  }
  if (cm_choke_clamped !== cm_choke) {
    warnings.push(
      `CM choke clamped to ${fmtH(cm_choke_clamped)} (practical range 1–47 mH).`,
    )
  }
  if (spec.vinMax > 500) {
    warnings.push(
      `Vin_max = ${spec.vinMax} V exceeds typical X2 capacitor ratings (275 Vrms / 400 Vdc). ` +
      `Use X1 class capacitors (440 Vrms) for 277 Vrms mains.`,
    )
  }

  return {
    dm_inductor,
    dm_capacitor,
    cm_choke: cm_choke_clamped,
    x_capacitor,
    y_capacitors,
    damping_resistor,
    damping_capacitor,
    filter_resonant_freq,
    filter_attenuation_at_fsw,
    required_attenuation_db,
    middlebrook_stable,
    negative_input_impedance,
    filter_output_impedance_at_resonance,
    stability_margin_db,
    filter_inductor_loss_w,
    components,
    warnings,
  }
}

// ── Impedance sweep helpers (exported for the D3 chart) ──────────────────────

/**
 * Compute filter output impedance |Zout(f)| for the DM LC + damping network.
 *
 * Circuit: Lf in series with the parallel combination of Cf || (Rd + Cd).
 * Returns magnitude in Ω at each frequency in `freqs`.
 */
export function filterOutputImpedance(
  lf: number, cf: number, rd: number, cd: number, freqs: number[],
): number[] {
  return freqs.map((f) => {
    const w = 2 * Math.PI * f
    // Impedance of Cf: 1/(jωCf)
    const zCf_re = 0
    const zCf_im = -1 / (w * cf)
    // Impedance of Rd + Cd series: Rd + 1/(jωCd)
    const zRdCd_re = rd
    const zRdCd_im = -1 / (w * cd)
    // Parallel: Z1||Z2 = (Z1×Z2)/(Z1+Z2)
    const denom_re = zCf_re + zRdCd_re
    const denom_im = zCf_im + zRdCd_im
    const denom_mag2 = denom_re * denom_re + denom_im * denom_im
    const num_re = zCf_re * zRdCd_re - zCf_im * zRdCd_im
    const num_im = zCf_re * zRdCd_im + zCf_im * zRdCd_re
    const zPar_re = (num_re * denom_re + num_im * denom_im) / denom_mag2
    const zPar_im = (num_im * denom_re - num_re * denom_im) / denom_mag2
    // Total: Lf + zPar
    const zTot_re = zPar_re
    const zTot_im = w * lf + zPar_im
    return Math.sqrt(zTot_re * zTot_re + zTot_im * zTot_im)
  })
}

/**
 * Converter negative input impedance magnitude vs frequency.
 *
 * At DC: |Zin| = Vin² / Pout. At high frequency it transitions to the
 * switch-node impedance. Approximation: flat negative resistance up to fsw,
 * then rises as +20 dB/dec (capacitive input filter dominates).
 */
export function converterInputImpedance(
  zinDC: number, fsw: number, freqs: number[],
): number[] {
  return freqs.map((f) => {
    if (f <= fsw) return zinDC
    // Above fsw: impedance rises (simplified), doubling every decade
    return zinDC * Math.pow(f / fsw, 0.5)
  })
}
