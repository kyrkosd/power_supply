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
  attenuation_override_db: number  // 0 = auto from EMI result
  cm_choke_h: number               // 0 = auto select
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
  dm_inductor: number
  dm_capacitor: number
  cm_choke: number
  x_capacitor: number
  y_capacitors: number
  damping_resistor: number
  damping_capacitor: number
  filter_resonant_freq: number
  filter_attenuation_at_fsw: number
  required_attenuation_db: number
  middlebrook_stable: boolean
  negative_input_impedance: number
  filter_output_impedance_at_resonance: number
  stability_margin_db: number
  filter_inductor_loss_w: number
  components: FilterComponent[]
  warnings: string[]
}

// ── E12 value snapping ────────────────────────────────────────────────────────

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]

function nearestE12(value: number): number {
  if (value <= 0) return E12[0]
  const exp      = Math.floor(Math.log10(value))
  const mantissa = value / Math.pow(10, exp)
  let best = E12[0], bestErr = Math.abs(mantissa - best)
  for (const v of E12) {
    const err = Math.abs(mantissa - v)
    if (err < bestErr) { best = v; bestErr = err }
  }
  return best * Math.pow(10, exp)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

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

// ── Design sub-steps ──────────────────────────────────────────────────────────

/** Step 1 — Required DM attenuation target in dB. */
function resolveAttenuationTarget(opts: InputFilterOptions, emi: EMIResult): number {
  if (opts.attenuation_override_db > 0) return opts.attenuation_override_db
  if (emi.worst_margin_db < 0) return Math.abs(emi.worst_margin_db) + 6
  // Even when compliant, a minimum 20 dB filter is standard practice
  return Math.max(20, 6 - emi.worst_margin_db)
}

/**
 * Step 2 — DM LC filter (Lf, Cf).
 * Target resonance: f_res = fsw / 10 gives 40 dB/dec roll-off well below fsw.
 * Z0 ≈ Vin / (2 × Ipeak) — balanced L/C split at resonance (Erickson §10.1 eq. 10.4).
 */
function computeDmFilter(spec: DesignSpec, result: DesignResult, fsw: number) {
  const f_res_target = Math.max(1000, fsw / 10)
  const z0           = Math.max(1, spec.vinMin / (2 * Math.max(result.peakCurrent, 0.1)))
  const omega_res    = 2 * Math.PI * f_res_target
  const dm_inductor  = nearestE12(z0 / omega_res)
  const dm_capacitor = nearestE12(1 / (z0 * omega_res))
  const filter_resonant_freq      = 1 / (2 * Math.PI * Math.sqrt(dm_inductor * dm_capacitor))
  // 40 dB/dec above resonance — TI SLYT636 eq. 1
  const filter_attenuation_at_fsw = 40 * Math.log10(Math.max(fsw / filter_resonant_freq, 1))
  return { dm_inductor, dm_capacitor, filter_resonant_freq, filter_attenuation_at_fsw, z0 }
}

/**
 * Step 3 — Rd + Cd damping network (Erickson §10.2).
 * Rd = Z0/3 → Q ≈ 1. Cd = 4 × Cf ensures Rd doesn't short Cf at DC.
 */
function computeDampingNetwork(z0: number, dm_capacitor: number) {
  return {
    damping_resistor:  z0 / 3,
    damping_capacitor: nearestE12(4 * dm_capacitor),
  }
}

/**
 * Step 4 — Middlebrook stability criterion.
 * |Zin| = Vin² / (Pout / η)  (Middlebrook IEEE IAS 1976 eq. 3).
 * Stability: |Zout_peak| < |Zin| / 3  (tightened criterion, Erickson §10.3).
 */
function computeMiddlebrook(spec: DesignSpec, result: DesignResult, damping_resistor: number) {
  const pout = spec.vout * spec.iout
  const eff  = result.efficiency ?? spec.efficiency
  const negative_input_impedance             = spec.vinMin ** 2 / (pout / eff)
  const filter_output_impedance_at_resonance = damping_resistor
  const stability_margin_db = 20 * Math.log10(
    negative_input_impedance / (3 * filter_output_impedance_at_resonance),
  )
  const middlebrook_stable =
    (filter_output_impedance_at_resonance / negative_input_impedance) < 1 / 3
  return { negative_input_impedance, filter_output_impedance_at_resonance, stability_margin_db, middlebrook_stable }
}

/**
 * Step 5 — CM choke and safety capacitors.
 * Y capacitors: IEC 60384-14 safety class, max 4.7 nF line-to-PE.
 * Reference: Würth ANP008e §3.
 */
function computeCmFilter(opts: InputFilterOptions, emi: EMIResult, fsw: number) {
  const cm_choke_raw = opts.cm_choke_h > 0
    ? opts.cm_choke_h
    : nearestE12(Math.max(1e-3,
        1 / (2 * Math.PI * Math.max(emi.first_failing_harmonic ?? fsw, fsw) * 2.2e-9 * 4),
      ))
  const cm_choke     = Math.min(47e-3, Math.max(1e-3, cm_choke_raw))
  return {
    cm_choke,
    was_clamped: cm_choke !== cm_choke_raw,
    x_capacitor: nearestE12(100e-9),
    y_capacitors: 2.2e-9,
  }
}

/** Step 6 — BOM component list. */
function buildFilterComponents(
  spec: DesignSpec,
  result: DesignResult,
  dm_inductor: number,
  dm_capacitor: number,
  damping_resistor: number,
  damping_capacitor: number,
  cm_choke: number,
  x_capacitor: number,
  y_capacitors: number,
): FilterComponent[] {
  const vin_rat = `${(spec.vinMax * 1.5).toFixed(0)} V`
  const vin_max = `${spec.vinMax.toFixed(0)} V`
  const i_pk    = `${result.peakCurrent.toFixed(1)} A`
  const i_rip   = `Irms ≥ ${(result.peakCurrent * 0.3).toFixed(1)} A`
  return [
    { ref: 'Lf',  type: 'DM Inductor',           value: fmtH(dm_inductor),    voltage_rating: vin_rat, current_rating: i_pk },
    { ref: 'Cf',  type: 'DM Capacitor (X2)',      value: fmtF(dm_capacitor),   voltage_rating: vin_rat, current_rating: i_rip },
    { ref: 'Rd',  type: 'Damping Resistor',       value: fmtR(damping_resistor),  voltage_rating: vin_rat, current_rating: i_pk },
    { ref: 'Cd',  type: 'Damping Capacitor (X2)', value: fmtF(damping_capacitor), voltage_rating: vin_rat, current_rating: i_rip },
    { ref: 'Lcm', type: 'CM Choke',               value: fmtH(cm_choke),       voltage_rating: vin_max, current_rating: i_pk },
    { ref: 'Cx',  type: 'X2 Safety Capacitor',    value: fmtF(x_capacitor),    voltage_rating: '275 Vrms (X2)', current_rating: '—' },
    { ref: 'Cy1', type: 'Y2 Safety Capacitor',    value: fmtF(y_capacitors),   voltage_rating: '250 Vrms (Y2)', current_rating: '—' },
    { ref: 'Cy2', type: 'Y2 Safety Capacitor',    value: fmtF(y_capacitors),   voltage_rating: '250 Vrms (Y2)', current_rating: '—' },
  ]
}

/** Collect design warnings. */
function buildFilterWarnings(
  spec: DesignSpec,
  filter_resonant_freq: number,
  filter_attenuation_at_fsw: number,
  required_attenuation_db: number,
  middlebrook_stable: boolean,
  stability_margin_db: number,
  filter_output_impedance_at_resonance: number,
  negative_input_impedance: number,
  cm_choke: number,
  was_clamped: boolean,
): string[] {
  const warnings: string[] = []
  if (filter_attenuation_at_fsw < required_attenuation_db) {
    warnings.push(
      `Filter provides ${filter_attenuation_at_fsw.toFixed(0)} dB at fsw but ${required_attenuation_db.toFixed(0)} dB is required. ` +
      `Reduce f_res (increase L and C) or add a second filter stage.`,
    )
  }
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
  if (filter_resonant_freq < 500) {
    warnings.push(
      `Filter resonance at ${filter_resonant_freq.toFixed(0)} Hz is close to line frequency. ` +
      `Reduce filter component values.`,
    )
  }
  if (was_clamped) {
    warnings.push(`CM choke clamped to ${fmtH(cm_choke)} (practical range 1–47 mH).`)
  }
  if (spec.vinMax > 500) {
    warnings.push(
      `Vin_max = ${spec.vinMax} V exceeds typical X2 capacitor ratings (275 Vrms / 400 Vdc). ` +
      `Use X1 class capacitors (440 Vrms) for 277 Vrms mains.`,
    )
  }
  return warnings
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
  const fsw = spec.fsw

  const required_attenuation_db = resolveAttenuationTarget(opts, emi)
  const { dm_inductor, dm_capacitor, filter_resonant_freq, filter_attenuation_at_fsw, z0 } =
    computeDmFilter(spec, result, fsw)
  const { damping_resistor, damping_capacitor } =
    computeDampingNetwork(z0, dm_capacitor)
  const { negative_input_impedance, filter_output_impedance_at_resonance, stability_margin_db, middlebrook_stable } =
    computeMiddlebrook(spec, result, damping_resistor)
  const { cm_choke, was_clamped, x_capacitor, y_capacitors } =
    computeCmFilter(opts, emi, fsw)

  // DCR estimate: typical power filter inductor has DCR ≈ Z0 / 100 (conservative)
  const filter_inductor_loss_w = result.peakCurrent ** 2 * Math.max(0.005, z0 / 100)

  const components = buildFilterComponents(
    spec, result, dm_inductor, dm_capacitor, damping_resistor, damping_capacitor,
    cm_choke, x_capacitor, y_capacitors,
  )
  const warnings = buildFilterWarnings(
    spec, filter_resonant_freq, filter_attenuation_at_fsw, required_attenuation_db,
    middlebrook_stable, stability_margin_db, filter_output_impedance_at_resonance,
    negative_input_impedance, cm_choke, was_clamped,
  )

  return {
    dm_inductor, dm_capacitor,
    cm_choke, x_capacitor, y_capacitors,
    damping_resistor, damping_capacitor,
    filter_resonant_freq, filter_attenuation_at_fsw, required_attenuation_db,
    middlebrook_stable, negative_input_impedance, filter_output_impedance_at_resonance,
    stability_margin_db, filter_inductor_loss_w, components, warnings,
  }
}

// ── Impedance sweep helpers (exported for the D3 chart) ──────────────────────

/**
 * Compute filter output impedance |Zout(f)| for the DM LC + damping network.
 * Circuit: Lf in series with the parallel combination of Cf || (Rd + Cd).
 * Returns magnitude in Ω at each frequency in `freqs`.
 */
export function filterOutputImpedance(
  lf: number, cf: number, rd: number, cd: number, freqs: number[],
): number[] {
  return freqs.map((f) => {
    const w = 2 * Math.PI * f
    const zCf_re = 0,    zCf_im   = -1 / (w * cf)
    const zRdCd_re = rd, zRdCd_im = -1 / (w * cd)
    const denom_re = zCf_re + zRdCd_re
    const denom_im = zCf_im + zRdCd_im
    const denom_mag2 = denom_re * denom_re + denom_im * denom_im
    const num_re  = zCf_re * zRdCd_re - zCf_im * zRdCd_im
    const num_im  = zCf_re * zRdCd_im + zCf_im * zRdCd_re
    const zPar_re = (num_re * denom_re + num_im * denom_im) / denom_mag2
    const zPar_im = (num_im * denom_re - num_re * denom_im) / denom_mag2
    return Math.sqrt(zPar_re * zPar_re + (w * lf + zPar_im) * (w * lf + zPar_im))
  })
}

/**
 * Converter negative input impedance magnitude vs frequency.
 * Flat negative resistance up to fsw, then rises as +20 dB/dec above.
 */
export function converterInputImpedance(
  zinDC: number, fsw: number, freqs: number[],
): number[] {
  return freqs.map((f) =>
    f <= fsw ? zinDC : zinDC * Math.pow(f / fsw, 0.5),
  )
}
