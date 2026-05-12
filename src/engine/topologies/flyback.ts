import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import {
  DesignSpec, DesignResult, Topology, TransferFunction,
  SecondaryOutput, SecondaryOutputResult,
} from '../types'
import { checkSaturation } from '../inductor-saturation'
import { designSnubber, DEFAULT_LEAKAGE_RATIO } from '../snubber'
import { selectCore } from './core-selector'
import type { CoreData } from './core-selector'

// ── Magnetics formula helpers ─────────────────────────────────────────────────

// Erickson & Maksimovic eq. 13.6 — limits to 0.45 for safe operating margin
function computeDutyCycle(vinNom: number, vout: number): number {
  return Math.min(0.45, vout / (vinNom + vout))
}

// Turns ratio Np/Ns from volt-seconds balance at nominal operating point.
// Mohan, Undeland, Robbins "Power Electronics" 3rd ed., eq. 10.3
function computeTurnsRatio(vinNom: number, D: number, vout: number): number {
  return (vinNom * D) / vout
}

// TI SLUA117B eq. 3 — minimum magnetizing inductance for CCM boundary
function computeMagnetizingInductance(vinMin: number, D: number, pTotal: number, fsw: number): number {
  return (vinMin * D) ** 2 / (2 * pTotal * fsw)
}

// Ns_k = Np × (Vout_k + Vf_k) / (Vin_nom × D)
// Mohan, Undeland, Robbins 3rd ed., eq. 10.3
function computeSecondaryTurns(Np: number, D: number, vinNom: number, vout_k: number, vf_k: number): number {
  return Math.ceil(Np * (vout_k + vf_k) / (vinNom * D))
}

// Reverse voltage the secondary rectifier must block.
// Kazimierczuk "High-Frequency Magnetic Components" 2nd ed., eq. 3.12
function computeDiodeVr(ns: number, np: number, vinMax: number, vout_k: number): number {
  return vout_k + (ns / np) * vinMax
}

// Cout_k ≥ Iout_k × D / (fsw × ΔVout_k) with 2 % ripple budget
function computeSecondaryCapacitance(iout_k: number, D: number, fsw: number, vout_k: number): number {
  return (iout_k * D) / (fsw * vout_k * 0.02)
}

// Cross-regulation estimate under ±50 % primary load variation.
// D shifts ≈ ±12 % for a well-designed CCM flyback.
// Mohan, Undeland, Robbins 3rd ed., Fig. 10-8
function estimateCrossRegPct(ns: number, np: number, vinNom: number, D: number, vout_k: number): number {
  return ((ns / np) * vinNom * (D * 0.12) / vout_k) * 100
}

// ── Secondary output results ──────────────────────────────────────────────────

function computeSecondaryResultsWithFsw(
  secondaries: SecondaryOutput[],
  primaryTurns: number,
  D: number,
  vinNom: number,
  vinMax: number,
  fsw: number,
): SecondaryOutputResult[] {
  return secondaries.map((s, i) => {
    const ns           = computeSecondaryTurns(primaryTurns, D, vinNom, s.vout, s.diode_vf)
    const diode_vr_max = computeDiodeVr(ns, primaryTurns, vinMax, s.vout)
    const capacitance  = computeSecondaryCapacitance(s.iout, D, fsw, s.vout)
    const crossRegPct  = s.is_regulated ? 0 : estimateCrossRegPct(ns, primaryTurns, vinNom, D, s.vout)
    return { label: `Output ${i + 2}`, vout_nominal: s.vout, ns, diode_vr_max, capacitance, crossRegPct }
  })
}

// ── Transfer function ─────────────────────────────────────────────────────────

function createFlybackTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const D     = result.dutyCycle
  const Lm    = result.magnetizingInductance || result.inductance
  const C     = result.capacitance
  const Rload = spec.vout / spec.iout
  const N     = result.turnsRatio || 1
  const k     = N * (1 - D)
  const omegaRHPZ = (1 - D) ** 2 * Rload / (2 * Math.PI * Lm)
  const omegaP    = 1 / Math.sqrt(Lm * C)

  return {
    numerator:   [k, -k * omegaRHPZ / (2 * Math.PI)],
    denominator: [1, omegaP / (2 * Math.PI), 0],
    evaluate(freq_hz: number) {
      const s   = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ / (2 * Math.PI), complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omegaP / (2 * Math.PI), s)), complex(0, 0))
      const h   = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h as Complex)),
        phase_deg:    arg(h as Complex) * (180 / Math.PI),
      }
    },
  }
}

// ── Compute helpers ───────────────────────────────────────────────────────────

interface FlybackOperatingPoint {
  dMax:               number  // — — maximum duty cycle
  pTotal:             number  // W — total output power (all windings)
  magnetizingInductance: number  // H
  primaryCurrentAvg:  number  // A
  deltaIm:            number  // A — magnetizing current ripple
  primaryPeakCurrent: number  // A
  turnsRatio:         number  // Np/Ns
}

/**
 * Primary operating point for a CCM flyback.
 * Duty cycle: Erickson & Maksimovic eq. 13.6.
 * Magnetizing inductance: TI SLUA117B eq. 3.
 */
function computeOperatingPoint(spec: DesignSpec, secondaries: SecondaryOutput[]): FlybackOperatingPoint {
  const { vinMin, vinMax, vout, iout, fsw, rippleRatio, efficiency } = spec
  const vinNom     = (vinMin + vinMax) / 2
  const dMax       = computeDutyCycle(vinNom, vout)
  const pPrimary   = vout * iout
  const pSecondaries = secondaries.reduce((s, o) => s + o.vout * o.iout, 0)
  const pTotal     = pPrimary + pSecondaries
  const magnetizingInductance = computeMagnetizingInductance(vinMin, dMax, pTotal, fsw)
  const inputPower         = pTotal / Math.max(efficiency, 0.7)
  const primaryCurrentAvg  = inputPower / vinMin
  const deltaIm            = rippleRatio * primaryCurrentAvg
  const primaryPeakCurrent = primaryCurrentAvg + deltaIm / 2
  const turnsRatio         = computeTurnsRatio(vinNom, dMax, vout)
  return { dMax, pTotal, magnetizingInductance, primaryCurrentAvg, deltaIm, primaryPeakCurrent, turnsRatio }
}

interface FlybackCoreResult {
  selectedCore: CoreData
  primaryTurns: number
  secondaryTurns: number
}

/**
 * Core selection and winding turns for a flyback transformer.
 * Area-product method: AP ≥ Lm × Ip_peak × Ip_avg / (Bmax × J × ku).
 * Bmax = 0.3 T (ferrite), J = 400 kA/m², ku = 0.4.
 * Returns null when no core in the database meets the requirement.
 */
function computeCoreAndTurns(
  Lm: number,
  primaryPeakCurrent: number,
  primaryCurrentAvg: number,
  turnsRatio: number,
): FlybackCoreResult | null {
  const bMax = 0.3, j = 400_000, ku = 0.4
  const areaProduct = (Lm * primaryPeakCurrent * primaryCurrentAvg) / (bMax * j * ku)
  const core = selectCore(areaProduct)
  if (!core) return null
  const primaryTurns   = Math.ceil(Lm * primaryPeakCurrent / (bMax * core.Ae))
  const secondaryTurns = Math.ceil(primaryTurns / turnsRatio)
  return { selectedCore: core, primaryTurns, secondaryTurns }
}

/**
 * Simplified flyback loss model.
 * Copper losses use DCR estimates; core and switching losses use fixed placeholders
 * pending a full Steinmetz / MOSFET model. Clamp loss from the RCD snubber.
 */
function computeFlybackLosses(primaryCurrentAvg: number, iout: number, snubber: { P_dissipated: number }) {
  const primaryCopperLoss   = primaryCurrentAvg ** 2 * 0.1
  const secondaryCopperLoss = iout ** 2 * 0.05
  const coreLoss   = 0.5
  const mosfetLoss = 2
  const diodeLoss  = 1
  const clampLoss  = snubber.P_dissipated
  const total = primaryCopperLoss + secondaryCopperLoss + coreLoss + mosfetLoss + diodeLoss + clampLoss
  return { primaryCopperLoss, secondaryCopperLoss, coreLoss, mosfetLoss, diodeLoss, clampLoss, total }
}

/** CCM/DCM classification and design rule warnings for a flyback converter. */
function computeFlybackWarnings(
  spec: DesignSpec,
  dMax: number,
  snubber: { P_dissipated: number },
  pPrimary: number,
  iout: number,
  ccm_dcm_boundary: number,
  secondaries: SecondaryOutput[],
): { operating_mode: 'CCM' | 'DCM' | 'boundary'; warnings: string[] } {
  const warnings: string[] = []
  let operating_mode: 'CCM' | 'DCM' | 'boundary' = 'CCM'

  if (iout < ccm_dcm_boundary) {
    operating_mode = 'DCM'
    warnings.push('Operating in DCM. Equations assume CCM — results may be inaccurate. Increase inductance or load current to enter CCM.')
  } else if (iout < 1.2 * ccm_dcm_boundary) {
    operating_mode = 'boundary'
    warnings.push('Near CCM/DCM boundary. Performance may be unpredictable at light loads.')
  }

  if (dMax > 0.45)
    warnings.push('Duty cycle exceeds 45 % — consider DCM or a different topology.')

  if (snubber.P_dissipated > 0.05 * pPrimary)
    warnings.push(
      `RCD clamp dissipates ${snubber.P_dissipated.toFixed(1)} W ` +
      `(${((snubber.P_dissipated / pPrimary) * 100).toFixed(0)} % of Pout). ` +
      `Reduce leakage ratio or switching frequency to lower clamp losses.`,
    )

  if (secondaries.length > 0)
    warnings.push(
      'Cross-regulation on unregulated outputs is typically ±5–10 %. ' +
      'Use post-regulators (LDO) for tight regulation.',
    )

  return { operating_mode, warnings }
}

// ── Main topology object ──────────────────────────────────────────────────────

export const flybackTopology: Topology = {
  id: 'flyback',
  name: 'Flyback',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vinMax, vout, iout, fsw, voutRippleMax } = spec
    const secondaries = spec.secondary_outputs ?? []
    const vinNom      = (vinMin + vinMax) / 2

    const op = computeOperatingPoint(spec, secondaries)
    const { dMax, pTotal, magnetizingInductance, primaryCurrentAvg, deltaIm, primaryPeakCurrent, turnsRatio } = op

    const coreResult = computeCoreAndTurns(magnetizingInductance, primaryPeakCurrent, primaryCurrentAvg, turnsRatio)
    if (!coreResult) {
      return {
        dutyCycle: dMax, inductance: magnetizingInductance, capacitance: 0,
        peakCurrent: primaryPeakCurrent,
        warnings: ['No suitable core found for the required area product'],
      }
    }
    const { selectedCore, primaryTurns, secondaryTurns } = coreResult

    const deltaVout   = Math.max(voutRippleMax, 0.01 * vout)
    const capacitance = (iout * dMax) / (fsw * deltaVout)

    const snubber = designSnubber('flyback', spec, {
      dutyCycle: dMax, inductance: magnetizingInductance, capacitance: 0,
      peakCurrent: primaryPeakCurrent, magnetizingInductance, turnsRatio, warnings: [],
    }, spec.leakageRatio ?? DEFAULT_LEAKAGE_RATIO)

    const lossBreakdown = computeFlybackLosses(primaryCurrentAvg, iout, snubber)

    const ccm_dcm_boundary = deltaIm * turnsRatio * (1 - dMax) / 2
    const pPrimary = vout * iout
    const { operating_mode, warnings } = computeFlybackWarnings(
      spec, dMax, snubber, pPrimary, iout, ccm_dcm_boundary, secondaries,
    )

    const secondaryOutputResults = secondaries.length > 0
      ? computeSecondaryResultsWithFsw(secondaries, primaryTurns, dMax, vinNom, vinMax, fsw)
      : undefined

    const saturation_check = checkSaturation(primaryPeakCurrent, primaryCurrentAvg)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    return {
      dutyCycle:   dMax,
      inductance:  magnetizingInductance,
      capacitance,
      peakCurrent: primaryPeakCurrent,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      snubber,
      efficiency: pPrimary / (pPrimary + lossBreakdown.total),
      warnings,
      turnsRatio,
      primaryTurns,
      secondaryTurns,
      coreType:   selectedCore.type,
      magnetizingInductance,
      clampVoltage: snubber.V_clamp,
      secondaryOutputResults,
      losses: {
        primaryCopper:   lossBreakdown.primaryCopperLoss,
        secondaryCopper: lossBreakdown.secondaryCopperLoss,
        core:   lossBreakdown.coreLoss,
        mosfet: lossBreakdown.mosfetLoss,
        diode:  lossBreakdown.diodeLoss,
        clamp:  lossBreakdown.clampLoss,
        total:  lossBreakdown.total,
      },
    }
  },

  getTransferFunction(spec, result) {
    return createFlybackTransferFunction(spec, result)
  },
}
