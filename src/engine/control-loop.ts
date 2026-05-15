// Control-loop analysis for switching power supplies (buck, voltage- and current-mode).
//
// References:
//   Erickson & Maksimovic 3rd ed., §8.1 — buck converter averaged model
//   Erickson & Maksimovic 3rd ed., §11.3 — peak current-mode slope compensation
//   Ridley (1991) — single-pole current-mode approximation
//
// Sub-modules:
//   control/tf-math.ts     — polynomial transfer-function evaluation + Bode helpers
//   control/plant.ts       — voltage- and current-mode buck plant polynomials
//   control/compensator.ts — design-frequency search + gain scaling
//   control/bode.ts        — 500-point Bode array computation
//   control/slope.ts       — slope-compensation requirement
//   control/warnings.ts    — phase/gain margin warnings

import type { DesignSpec, DesignResult } from './types'
import type { BodePoint } from './control/tf-math'
import { findCrossoverPoint, findGainMargin } from './control/tf-math'
import { selectPlant, type ControlMode } from './control/plant'
import { findDesignFrequency, scaleCompensatorGain } from './control/compensator'
import { computeBodeArrays } from './control/bode'
import { computeSlopeCompensation, type SlopeCompensation } from './control/slope'
import { buildLoopWarnings } from './control/warnings'

export type { ControlMode, BodePoint, SlopeCompensation }

export interface ControlLoopAnalysis {
  frequency_hz: number[]
  plant: BodePoint[]
  compensator: BodePoint[]
  loop: BodePoint[]
  designFrequencyHz: number
  crossoverFrequencyHz: number
  phaseMarginDeg: number
  gainMarginDb: number
  warnings: string[]
  controlMode: ControlMode
  slopeCompensation: SlopeCompensation
}

interface AnalyzeOptions {
  esr?: number
  targetCrossoverHz?: number
  targetPhaseMarginDeg?: number
  controlMode?: ControlMode
}

const DEFAULT_ESR_OHM       = 0.05
const DEFAULT_PHASE_MARGIN  = 60

function resolveOptions(spec: DesignSpec, options?: AnalyzeOptions) {
  return {
    Esr:                 options?.esr                ?? DEFAULT_ESR_OHM,
    controlMode:         (options?.controlMode      ?? spec.controlMode ?? 'voltage') as ControlMode,
    targetCrossoverHz:   options?.targetCrossoverHz ?? spec.fsw / 10,
    desiredPhaseMargin:  options?.targetPhaseMarginDeg ?? DEFAULT_PHASE_MARGIN,
  }
}

// Called by:
//   - buck.ts (computeBuck) — loop analysis runs inline with every COMPUTE to populate Bode data
//   - mc/iteration.ts (tryPhaseMargin) — perturbed-component phase-margin check per MC iteration
// Why: keeping loop analysis in the engine layer (rather than a component) means the Bode
// result is part of DesignResult and available to all consumers (chart, PDF export, warnings)
// without a second worker round-trip.
export function analyzeBuckControlLoop(
  spec: DesignSpec, result: DesignResult, options?: AnalyzeOptions,
): ControlLoopAnalysis {
  const { Esr, controlMode, targetCrossoverHz, desiredPhaseMargin } = resolveOptions(spec, options)
  const L     = result.inductance
  const C     = result.capacitance
  const Rload = spec.vout / spec.iout

  const { numerator: plantNum, denominator: plantDen, z0, p0 } =
    selectPlant(controlMode, spec, L, C, Esr, Rload)

  const normCompNumerator   = [1, z0] as const
  const normCompDenominator = [1 / p0, 1, 0] as const

  const designFreq = findDesignFrequency(
    plantNum, plantDen, normCompNumerator, normCompDenominator,
    targetCrossoverHz, desiredPhaseMargin, spec,
  )

  const { compensatorNumerator, compensatorDenominator } = scaleCompensatorGain(
    plantNum, plantDen, normCompNumerator, normCompDenominator, designFreq, z0, p0,
  )

  const { freqs, plant, compensator, loop } = computeBodeArrays(
    plantNum, plantDen, compensatorNumerator, compensatorDenominator, spec,
  )

  const crossover = findCrossoverPoint(loop, designFreq)
  const gainPoint = findGainMargin(loop)

  const crossoverFrequencyHz = crossover?.freq ?? NaN
  const phaseMarginDeg       = crossover ? 180 + crossover.phase : NaN
  const gainMarginDb         = gainPoint ? -gainPoint.magnitude_db : NaN

  const slopeCompensation = computeSlopeCompensation(spec, result)
  const warnings = buildLoopWarnings(
    controlMode, result, slopeCompensation,
    { phaseMarginDeg, gainMarginDb, crossoverFrequencyHz }, spec,
  )

  return {
    frequency_hz: freqs, plant, compensator, loop,
    designFrequencyHz: designFreq, crossoverFrequencyHz, phaseMarginDeg, gainMarginDb,
    warnings, controlMode, slopeCompensation,
  }
}
