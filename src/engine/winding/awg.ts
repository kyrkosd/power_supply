// AWG wire table (NEMA MW1000) + wire-selection / DC-resistance / packing helpers.
// Reference: Kazimierczuk Table 2.3, Ch. 4.2.

import type { WindingSection } from '../types'

export interface AwgEntry {
  awg: number
  diameter_mm: number
  area_mm2: number
}

export const AWG_TABLE: AwgEntry[] = [
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

export const J_CU       = 4.0          // A/mm² — target current density (Kazimierczuk §4.2)
export const RHO_CU     = 1.72e-8       // Ω·m   — copper resistivity at 20 °C
export const INS_FACTOR = 1.10          // bare → insulated diameter
export const MAX_FILL   = 0.60          // maximum acceptable bobbin fill ratio

export function findAwg(awg: number): AwgEntry {
  return AWG_TABLE.find((w) => w.awg === awg)!
}

/** Thickest AWG whose bare diameter ≤ 2δ; strands in parallel to carry Irms. */
export function selectWire(irms: number, delta_mm: number): { awg: AwgEntry; strands: number } {
  const eligible = AWG_TABLE.filter((w) => w.diameter_mm <= 2 * delta_mm)
  const base     = eligible.length > 0 ? eligible[eligible.length - 1] : AWG_TABLE[0]
  return { awg: base, strands: Math.max(1, Math.ceil(irms / (base.area_mm2 * J_CU))) }
}

/** Simplified hexagonal packing: effective pitch per turn ≈ d_ins × √strands. */
export function countLayers(turns: number, strands: number, awg: AwgEntry, bobbinWidth_mm: number): number {
  const pitch         = awg.diameter_mm * INS_FACTOR * Math.sqrt(strands)
  const turnsPerLayer = Math.max(1, Math.floor(bobbinWidth_mm / pitch))
  return Math.max(1, Math.ceil(turns / turnsPerLayer))
}

/** Kazimierczuk eq. 4.2: R = ρ × (MLT × N) / A_conductor. Returns mΩ. */
export function dcResistanceMohm(turns: number, strands: number, awg: AwgEntry, MLT_m: number): number {
  const A_m2 = awg.area_mm2 * strands * 1e-6
  return (RHO_CU * MLT_m * turns / A_m2) * 1e3
}

export function conductorAreaMm2(s: WindingSection): number {
  return s.turns * s.strands * findAwg(s.wire_gauge_awg).area_mm2
}
