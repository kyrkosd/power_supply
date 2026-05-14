// Winding-section construction, fill-factor accounting, and proximity copper loss.

import type { DesignResult, WindingSection, WindingResult } from '../types'
import {
  selectWire, countLayers, dcResistanceMohm, conductorAreaMm2, findAwg,
} from './awg'
import { dowellFr } from './physics'
import { flybackSecondaryRms } from './currents'

export function buildSection(
  turns: number, irms: number, delta_mm: number, MLT_m: number, bobbinWidth_mm: number,
): WindingSection {
  const { awg, strands } = selectWire(irms, delta_mm)
  const layers           = countLayers(turns, strands, awg, bobbinWidth_mm)
  return {
    turns,
    wire_gauge_awg:  awg.awg,
    strands,
    resistance_mohm: dcResistanceMohm(turns, strands, awg, MLT_m),
    fill_factor_pct: 0,
    layers,
  }
}

export function emptyResult(warnings: string[]): WindingResult {
  const s: WindingSection = { turns: 0, wire_gauge_awg: 26, strands: 1, resistance_mohm: 0, fill_factor_pct: 0, layers: 0 }
  return {
    primary:               { ...s },
    secondary:             [{ ...s }],
    winding_order:         [],
    estimated_leakage_nh:  0,
    skin_depth_mm:         0,
    max_strand_diameter_mm: 0,
    proximity_loss_factor: 1,
    total_copper_loss:     0,
    creepage_mm:           0,
    clearance_mm:          0,
    bobbin_fill_check:     false,
    warnings,
  }
}

/** Build winding sections for any additional flyback secondary outputs. */
export function computeAdditionalSecondaries(
  topology: 'flyback' | 'forward',
  result: DesignResult,
  Np: number, D: number,
  delta: number, MLT_m: number, bw_mm: number,
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
export function applyFillFactors(primary: WindingSection, allSecondaries: WindingSection[], bobArea: number): number {
  primary.fill_factor_pct = (conductorAreaMm2(primary) / bobArea) * 100
  for (const s of allSecondaries) s.fill_factor_pct = (conductorAreaMm2(s) / bobArea) * 100
  const totalCopperArea =
    conductorAreaMm2(primary) + allSecondaries.reduce((a, s) => a + conductorAreaMm2(s), 0)
  return totalCopperArea / bobArea
}

/** Proximity factor (Dowell 1966) and total copper loss for all windings. */
export function computeProximityAndCopperLoss(
  primary: WindingSection, allSecondaries: WindingSection[], allSecRms: number[],
  Ip_rms: number, delta: number,
): { Fr: number; total_copper_loss: number } {
  const primEntry = findAwg(primary.wire_gauge_awg)
  const Fr        = dowellFr(primary.layers, primEntry.diameter_mm, delta)
  const pPrimary  = Fr * (primary.resistance_mohm * 1e-3) * Ip_rms ** 2

  let pSecondary = 0
  for (let i = 0; i < allSecondaries.length; i++) {
    const s        = allSecondaries[i]
    const secEntry = findAwg(s.wire_gauge_awg)
    const Fr_s     = dowellFr(s.layers, secEntry.diameter_mm, delta)
    pSecondary    += Fr_s * (s.resistance_mohm * 1e-3) * allSecRms[i] ** 2
  }
  return { Fr, total_copper_loss: pPrimary + pSecondary }
}

export function determineWindingOrder(interleaved: boolean, nSec: number): string[] {
  if (interleaved && nSec === 1) return ['Primary (½)', 'Secondary 1', 'Primary (½)']
  if (nSec === 2)                return ['Primary (½)', 'Secondary 1', 'Secondary 2', 'Primary (½)']
  return ['Primary', ...Array.from({ length: nSec }, (_, i) => `Secondary ${i + 1}`)]
}
