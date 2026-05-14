// Transformer winding design for flyback and forward converters.
//
// References:
//   Dowell P.L. (1966) "Effects of eddy currents in transformer windings"
//     Proc. IEE 113(8):1387–1394 — proximity-effect factor Fr
//   Kazimierczuk "High-Frequency Magnetic Components" 2nd ed.
//     Ch. 2 (wire data), Ch. 4 (skin/proximity losses), Ch. 6 (leakage inductance)
//   IEC 62368-1:2018 Table F.5 — creepage and clearance for reinforced insulation
//
// Sub-modules:
//   winding/awg.ts        — AWG table + wire selection + DC resistance + fill area
//   winding/physics.ts    — skin depth, Dowell Fr, leakage Nh
//   winding/insulation.ts — IEC 62368-1 creepage and clearance lookup
//   winding/currents.ts   — RMS-current formulas per topology
//   winding/sections.ts   — section builder, fill factors, proximity loss
//   winding/warnings.ts   — fill / Fr / leakage / copper-loss diagnostics

import type { DesignSpec, DesignResult, WindingSection, WindingResult } from './types'
import type { CoreData } from './topologies/core-selector'
import { skinDepthMm, leakageNh } from './winding/physics'
import { creepageMm, clearanceMm } from './winding/insulation'
import { computePrimaryAndSecRms, flybackPrimaryRms, flybackSecondaryRms, forwardPrimaryRms, forwardSecondaryRms } from './winding/currents'
import {
  buildSection, emptyResult, computeAdditionalSecondaries,
  applyFillFactors, computeProximityAndCopperLoss, determineWindingOrder,
} from './winding/sections'
import { buildWindingWarnings } from './winding/warnings'
import { MAX_FILL } from './winding/awg'

export type { WindingSection, WindingResult }
// Public RMS helpers (kept exported for unit tests).
export { flybackPrimaryRms, flybackSecondaryRms, forwardPrimaryRms, forwardSecondaryRms }

const INSULATION_THICKNESS_M = 0.3e-3
const CLAMP_VOLTAGE_FALLBACK = 1.5  // ×Vin_max when result.clampVoltage is absent

interface CoreGeometry {
  delta:  number   // mm — skin depth at fsw
  MLT_m:  number   // mean length per turn (m)
  bw_mm:  number   // bobbin width
  bobArea: number  // mm² — available winding window
}

function loadCoreGeometry(core: CoreData, fsw: number): CoreGeometry {
  return {
    delta:   skinDepthMm(fsw),
    MLT_m:   core.MLT_mm * 1e-3,
    bw_mm:   core.bobbin_width_mm,
    bobArea: core.bobbin_width_mm * core.bobbin_height_mm,
  }
}

function workingVoltage(spec: DesignSpec, result: DesignResult): number {
  return result.clampVoltage ?? (spec.vinMax * CLAMP_VOLTAGE_FALLBACK)
}

export function designWinding(
  topology: 'flyback' | 'forward',
  spec: DesignSpec,
  result: DesignResult,
  core: CoreData,
): WindingResult {
  if (!result.primaryTurns || !result.secondaryTurns) {
    return emptyResult(['Primary/secondary turns unavailable — core not selected.'])
  }

  const Np = result.primaryTurns
  const Ns = result.secondaryTurns
  const D  = result.dutyCycle
  const { delta, MLT_m, bw_mm, bobArea } = loadCoreGeometry(core, spec.fsw)

  const { Ip_rms, Is_rms_main } = computePrimaryAndSecRms(topology, spec, result, Np, Ns, D)

  const primary = buildSection(Np, Ip_rms,      delta, MLT_m, bw_mm)
  const secMain = buildSection(Ns, Is_rms_main, delta, MLT_m, bw_mm)

  const { extraSections, extraRms } = computeAdditionalSecondaries(topology, result, Np, D, delta, MLT_m, bw_mm)
  const allSecondaries: WindingSection[] = [secMain, ...extraSections]
  const allSecRms = [Is_rms_main, ...extraRms]

  const fillRatio = applyFillFactors(primary, allSecondaries, bobArea)
  const { Fr, total_copper_loss } = computeProximityAndCopperLoss(primary, allSecondaries, allSecRms, Ip_rms, delta)

  const nSec        = allSecondaries.length
  const interleaved = nSec <= 2
  const estimated_leakage_nh = leakageNh(Np, MLT_m, bw_mm * 1e-3, INSULATION_THICKNESS_M, interleaved)
  const workingV    = workingVoltage(spec, result)

  return {
    primary,
    secondary:              allSecondaries,
    winding_order:          determineWindingOrder(interleaved, nSec),
    estimated_leakage_nh,
    skin_depth_mm:          delta,
    max_strand_diameter_mm: 2 * delta,
    proximity_loss_factor:  Fr,
    total_copper_loss,
    creepage_mm:            creepageMm(workingV),
    clearance_mm:           clearanceMm(workingV),
    bobbin_fill_check:      fillRatio <= MAX_FILL,
    warnings:               buildWindingWarnings(fillRatio, Fr, estimated_leakage_nh, result, spec, total_copper_loss),
  }
}
