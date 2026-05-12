// Transformer winding design for flyback and forward converters.
// References:
//   Dowell P.L. (1966) "Effects of eddy currents in transformer windings"
//     Proc. IEE 113(8):1387–1394  — proximity-effect factor Fr
//   Kazimierczuk "High-Frequency Magnetic Components" 2nd ed.
//     Ch. 2 (wire data), Ch. 4 (skin/proximity losses), Ch. 6 (leakage inductance)
//   IEC 62368-1:2018 Table F.5 — creepage and clearance for reinforced insulation

import type { DesignSpec, DesignResult } from './types'
import type { CoreData } from './topologies/core-selector'

// ── Public types ──────────────────────────────────────────────────────────────

export interface WindingSection {
  turns: number
  wire_gauge_awg: number
  strands: number
  resistance_mohm: number  // DC resistance, mΩ
  fill_factor_pct: number  // this winding's copper area / bobbin area × 100
  layers: number
}

export interface WindingResult {
  primary: WindingSection
  secondary: WindingSection[]        // index 0 = main regulated output
  winding_order: string[]            // e.g. ["Primary (½)", "Sec 1", "Primary (½)"]
  estimated_leakage_nh: number       // nH — Kazimierczuk eq. 6.28
  skin_depth_mm: number              // δ at fsw
  max_strand_diameter_mm: number     // 2 × skin_depth
  proximity_loss_factor: number      // Fr = Rac/Rdc for primary (Dowell 1966)
  total_copper_loss: number          // W — DC + AC (Fr-weighted)
  creepage_mm: number                // IEC 62368-1, reinforced insulation
  clearance_mm: number
  bobbin_fill_check: boolean         // true = all copper fits (fill ≤ 60 %)
  warnings: string[]
}

// ── AWG wire table ─────────────────────────────────────────────────────────────
// Kazimierczuk Table 2.3 / NEMA MW1000 — bare copper wire, 20 °C

interface AwgEntry {
  awg: number
  diameter_mm: number
  area_mm2: number
}

const AWG_TABLE: AwgEntry[] = [
  { awg: 34, diameter_mm: 0.161, area_mm2: 0.02036 },
  { awg: 32, diameter_mm: 0.203, area_mm2: 0.03243 },
  { awg: 30, diameter_mm: 0.255, area_mm2: 0.05107 },
  { awg: 28, diameter_mm: 0.321, area_mm2: 0.08096 },
  { awg: 26, diameter_mm: 0.405, area_mm2: 0.12885 },
  { awg: 24, diameter_mm: 0.511, area_mm2: 0.20505 },
  { awg: 22, diameter_mm: 0.644, area_mm2: 0.32552 },
  { awg: 20, diameter_mm: 0.812, area_mm2: 0.51760 },
  { awg: 18, diameter_mm: 1.024, area_mm2: 0.82310 },
  { awg: 16, diameter_mm: 1.291, area_mm2: 1.30870 },
  { awg: 14, diameter_mm: 1.628, area_mm2: 2.08120 },
  { awg: 12, diameter_mm: 2.053, area_mm2: 3.30880 },
  { awg: 10, diameter_mm: 2.588, area_mm2: 5.26120 },
]

const J_CU      = 4.0         // A/mm² — target current density (Kazimierczuk §4.2)
const RHO_CU    = 1.72e-8     // Ω·m   — copper resistivity at 20 °C
const INS_FACTOR = 1.10       // bare diameter → insulated diameter (~10 % larger)
const MAX_FILL  = 0.60        // maximum acceptable winding fill ratio
const MU0       = 4 * Math.PI * 1e-7  // H/m

// ── Low-level helpers ─────────────────────────────────────────────────────────

// Kazimierczuk eq. 4.60: δ = 66.2 / √fsw mm, copper at 20 °C
function skinDepthMm(fsw: number): number {
  return 66.2 / Math.sqrt(fsw)
}

// Dowell (1966) eq. 11 with circular-wire correction (Kazimierczuk eq. 4.70).
// Returns max(1, Fr) — AC losses can only increase Rac.
function dowellFr(layers: number, strandDiam_mm: number, delta_mm: number): number {
  const eta = (strandDiam_mm / delta_mm) * Math.sqrt(Math.PI / 4)
  if (eta < 0.01) return 1
  const sinh2 = Math.sinh(2 * eta), cosh2 = Math.cosh(2 * eta)
  const sin2  = Math.sin(2 * eta),  cos2  = Math.cos(2 * eta)
  const sinhE = Math.sinh(eta), coshE = Math.cosh(eta)
  const sinE  = Math.sin(eta),  cosE  = Math.cos(eta)
  const term1 = eta * (sinh2 + sin2) / (cosh2 - cos2)
  const term2 = (2 * (layers ** 2 - 1) / 3) * eta * (sinhE - sinE) / (coshE + cosE)
  return Math.max(1, term1 + term2)
}

// Thickest AWG whose bare diameter ≤ 2δ; strands in parallel to carry Irms.
function selectWire(irms: number, delta_mm: number): { awg: AwgEntry; strands: number } {
  const eligible = AWG_TABLE.filter(w => w.diameter_mm <= 2 * delta_mm)
  const base     = eligible.length > 0 ? eligible[eligible.length - 1] : AWG_TABLE[0]
  return { awg: base, strands: Math.max(1, Math.ceil(irms / (base.area_mm2 * J_CU))) }
}

// Simplified hexagonal packing: effective pitch per turn ≈ d_ins × √strands.
function countLayers(turns: number, strands: number, awg: AwgEntry, bobbinWidth_mm: number): number {
  const pitch       = awg.diameter_mm * INS_FACTOR * Math.sqrt(strands)
  const turnsPerLayer = Math.max(1, Math.floor(bobbinWidth_mm / pitch))
  return Math.max(1, Math.ceil(turns / turnsPerLayer))
}

// Kazimierczuk eq. 4.2: R = ρ × (MLT × N) / A_conductor
function dcResistanceMohm(turns: number, strands: number, awg: AwgEntry, MLT_m: number): number {
  const A_m2 = awg.area_mm2 * strands * 1e-6
  return (RHO_CU * MLT_m * turns / A_m2) * 1e3
}

// Kazimierczuk eq. 6.28: Llk = μ₀ × Np² × MLT × (b_ins/3) / bw.
// Interleaved P–S–P winding reduces Llk ~4×.
function leakageNh(Np: number, MLT_m: number, bw_m: number, b_ins_m: number, interleaved: boolean): number {
  const Llk = MU0 * Np ** 2 * MLT_m * (b_ins_m / 3) / bw_m
  return (interleaved ? Llk / 4 : Llk) * 1e9
}

// IEC 62368-1:2018 Table F.5 — reinforced insulation, pollution degree 2.
function creepageMm(workingV: number): number {
  if (workingV <= 50)  return 1.5
  if (workingV <= 150) return 2.5
  if (workingV <= 300) return 4.0
  if (workingV <= 600) return 8.0
  return 12.0
}

function clearanceMm(workingV: number): number {
  if (workingV <= 50)  return 0.8
  if (workingV <= 150) return 1.5
  if (workingV <= 300) return 3.0
  if (workingV <= 600) return 6.0
  return 10.0
}

// ── RMS current helpers ────────────────────────────────────────────────────────
// Kazimierczuk eq. 4.11 — triangular current waveform (CCM)

export function flybackPrimaryRms(Ip_peak: number, D: number): number {
  return Ip_peak * Math.sqrt(D / 3)
}

export function flybackSecondaryRms(Ip_peak: number, N: number, D: number): number {
  return (Ip_peak / N) * Math.sqrt((1 - D) / 3)
}

export function forwardPrimaryRms(spec: DesignSpec, result: DesignResult): number {
  const eta   = result.efficiency ?? spec.efficiency
  const Ip_avg = (spec.vout * spec.iout) / (eta * spec.vinMin)
  return Ip_avg * Math.sqrt(result.dutyCycle)
}

export function forwardSecondaryRms(iout: number, D: number): number {
  return iout * Math.sqrt(D)
}

// ── Section builders ───────────────────────────────────────────────────────────

function conductorAreaMm2(s: WindingSection): number {
  return s.turns * s.strands * AWG_TABLE.find(w => w.awg === s.wire_gauge_awg)!.area_mm2
}

function buildSection(
  turns: number, irms: number, delta_mm: number, MLT_m: number, bobbinWidth_mm: number,
): WindingSection {
  const { awg, strands } = selectWire(irms, delta_mm)
  const layers           = countLayers(turns, strands, awg, bobbinWidth_mm)
  const resistance_mohm  = dcResistanceMohm(turns, strands, awg, MLT_m)
  return { turns, wire_gauge_awg: awg.awg, strands, resistance_mohm, fill_factor_pct: 0, layers }
}

function emptyResult(warnings: string[]): WindingResult {
  const s: WindingSection = { turns: 0, wire_gauge_awg: 26, strands: 1, resistance_mohm: 0, fill_factor_pct: 0, layers: 0 }
  return {
    primary: { ...s }, secondary: [{ ...s }], winding_order: [],
    estimated_leakage_nh: 0, skin_depth_mm: 0, max_strand_diameter_mm: 0,
    proximity_loss_factor: 1, total_copper_loss: 0,
    creepage_mm: 0, clearance_mm: 0, bobbin_fill_check: false, warnings,
  }
}

// ── Orchestration helpers ──────────────────────────────────────────────────────

/** Compute primary and main-secondary RMS currents by topology. */
function computePrimaryAndSecRms(
  topology: 'flyback' | 'forward',
  spec: DesignSpec,
  result: DesignResult,
  Np: number,
  Ns: number,
  D: number,
): { Ip_rms: number; Is_rms_main: number } {
  if (topology === 'flyback') {
    const N = result.turnsRatio ?? (Np / Ns)
    return {
      Ip_rms:      flybackPrimaryRms(result.peakCurrent, D),
      Is_rms_main: flybackSecondaryRms(result.peakCurrent, N, D),
    }
  }
  return {
    Ip_rms:      forwardPrimaryRms(spec, result),
    Is_rms_main: forwardSecondaryRms(spec.iout, D),
  }
}

/** Build winding sections for any additional flyback secondary outputs. */
function computeAdditionalSecondaries(
  topology: 'flyback' | 'forward',
  result: DesignResult,
  Np: number,
  D: number,
  delta: number,
  MLT_m: number,
  bw_mm: number,
): { extraSections: WindingSection[]; extraRms: number[] } {
  if (topology !== 'flyback' || !result.secondaryOutputResults) {
    return { extraSections: [], extraRms: [] }
  }
  const extraSections: WindingSection[] = []
  const extraRms: number[] = []
  for (const sr of result.secondaryOutputResults) {
    const irms = flybackSecondaryRms(result.peakCurrent, Np / sr.ns, D)
    extraSections.push(buildSection(sr.ns, irms, delta, MLT_m, bw_mm))
    extraRms.push(irms)
  }
  return { extraSections, extraRms }
}

/** Fill in fill_factor_pct for each section and return the total fill ratio. */
function applyFillFactors(
  primary: WindingSection,
  allSecondaries: WindingSection[],
  bobArea: number,
): number {
  primary.fill_factor_pct = (conductorAreaMm2(primary) / bobArea) * 100
  for (const s of allSecondaries) s.fill_factor_pct = (conductorAreaMm2(s) / bobArea) * 100
  const totalCopperArea =
    conductorAreaMm2(primary) + allSecondaries.reduce((a, s) => a + conductorAreaMm2(s), 0)
  return totalCopperArea / bobArea
}

/** Proximity factor (Dowell 1966) and total copper loss for all windings. */
function computeProximityAndCopperLoss(
  primary: WindingSection,
  allSecondaries: WindingSection[],
  allSecRms: number[],
  Ip_rms: number,
  delta: number,
): { Fr: number; total_copper_loss: number } {
  const primEntry = AWG_TABLE.find(w => w.awg === primary.wire_gauge_awg)!
  const Fr        = dowellFr(primary.layers, primEntry.diameter_mm, delta)
  const pPrimary  = Fr * (primary.resistance_mohm * 1e-3) * Ip_rms ** 2

  let pSecondary = 0
  for (let i = 0; i < allSecondaries.length; i++) {
    const s       = allSecondaries[i]
    const secEntry = AWG_TABLE.find(w => w.awg === s.wire_gauge_awg)!
    const Fr_s    = dowellFr(s.layers, secEntry.diameter_mm, delta)
    pSecondary   += Fr_s * (s.resistance_mohm * 1e-3) * allSecRms[i] ** 2
  }
  return { Fr, total_copper_loss: pPrimary + pSecondary }
}

/** Determine interleaved P–S–P winding order. */
function determineWindingOrder(interleaved: boolean, nSec: number): string[] {
  if (interleaved && nSec === 1) return ['Primary (½)', 'Secondary 1', 'Primary (½)']
  if (nSec === 2)               return ['Primary (½)', 'Secondary 1', 'Secondary 2', 'Primary (½)']
  return ['Primary', ...Array.from({ length: nSec }, (_, i) => `Secondary ${i + 1}`)]
}

/** Collect winding health warnings. */
function buildWindingWarnings(
  fillRatio: number,
  Fr: number,
  estimated_leakage_nh: number,
  result: DesignResult,
  spec: DesignSpec,
  total_copper_loss: number,
): string[] {
  const warnings: string[] = []
  if (fillRatio > MAX_FILL) {
    warnings.push(
      `Bobbin fill ${(fillRatio * 100).toFixed(0)} % exceeds 60 %. ` +
      'Consider a larger core or fewer parallel strands.',
    )
  } else if (fillRatio > 0.70) {
    warnings.push(
      `Tight winding window: fill = ${(fillRatio * 100).toFixed(0)} %. ` +
      'Consider a larger core or thinner wire.',
    )
  }
  if (Fr > 2) {
    warnings.push(
      `Significant AC winding loss: proximity factor Fr = ${Fr.toFixed(2)}. ` +
      'Reduce layers by using more parallel thin strands or litz wire.',
    )
  }
  const LmNh = (result.magnetizingInductance ?? result.inductance) * 1e9
  if (LmNh > 0 && estimated_leakage_nh > 0.05 * LmNh) {
    warnings.push(
      `Estimated leakage ${estimated_leakage_nh.toFixed(0)} nH is > 5 % of Lm. ` +
      'Consider interleaved winding to reduce leakage.',
    )
  }
  const Pout = spec.vout * spec.iout
  if (total_copper_loss > 0.05 * Pout) {
    warnings.push(
      `Total winding copper loss ${(total_copper_loss * 1000).toFixed(0)} mW ` +
      `exceeds 5 % of Pout (${(Pout * 1000).toFixed(0)} mW).`,
    )
  }
  return warnings
}

// ── Public entry point ─────────────────────────────────────────────────────────

export function designWinding(
  topology: 'flyback' | 'forward',
  spec: DesignSpec,
  result: DesignResult,
  core: CoreData,
): WindingResult {
  const warnings: string[] = []

  if (!result.primaryTurns || !result.secondaryTurns) {
    warnings.push('Primary/secondary turns unavailable — core not selected.')
    return emptyResult(warnings)
  }

  const Np     = result.primaryTurns
  const Ns     = result.secondaryTurns
  const D      = result.dutyCycle
  const delta  = skinDepthMm(spec.fsw)
  const MLT_m  = core.MLT_mm * 1e-3
  const bw_mm  = core.bobbin_width_mm
  const bobArea = bw_mm * core.bobbin_height_mm   // mm²

  const { Ip_rms, Is_rms_main } = computePrimaryAndSecRms(topology, spec, result, Np, Ns, D)

  const primary = buildSection(Np, Ip_rms,      delta, MLT_m, bw_mm)
  const secMain = buildSection(Ns, Is_rms_main, delta, MLT_m, bw_mm)

  const { extraSections, extraRms } = computeAdditionalSecondaries(topology, result, Np, D, delta, MLT_m, bw_mm)
  const allSecondaries = [secMain, ...extraSections]
  const allSecRms      = [Is_rms_main, ...extraRms]

  const fillRatio        = applyFillFactors(primary, allSecondaries, bobArea)
  const bobbin_fill_check = fillRatio <= MAX_FILL

  const { Fr, total_copper_loss } =
    computeProximityAndCopperLoss(primary, allSecondaries, allSecRms, Ip_rms, delta)

  const nSec       = allSecondaries.length
  const interleaved = nSec <= 2
  const estimated_leakage_nh = leakageNh(Np, MLT_m, bw_mm * 1e-3, 0.3e-3, interleaved)
  const winding_order        = determineWindingOrder(interleaved, nSec)

  // Working voltage for creepage/clearance: primary switch worst-case
  const workingV = result.clampVoltage ?? (spec.vinMax * 1.5)

  warnings.push(...buildWindingWarnings(fillRatio, Fr, estimated_leakage_nh, result, spec, total_copper_loss))

  return {
    primary,
    secondary: allSecondaries,
    winding_order,
    estimated_leakage_nh,
    skin_depth_mm:         delta,
    max_strand_diameter_mm: 2 * delta,
    proximity_loss_factor:  Fr,
    total_copper_loss,
    creepage_mm:    creepageMm(workingV),
    clearance_mm:   clearanceMm(workingV),
    bobbin_fill_check,
    warnings,
  }
}
