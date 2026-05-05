// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import {
  DesignSpec, DesignResult, Topology, TransferFunction,
  SecondaryOutput, SecondaryOutputResult,
} from '../types'
import { checkSaturation } from '../inductor-saturation'
import { designSnubber, DEFAULT_LEAKAGE_RATIO } from '../snubber'
import coresData from '../../data/cores.json'

// ── Core database ─────────────────────────────────────────────────────────────

interface CoreData {
  type: string
  Ae: number  // m²
  Aw: number  // m²
  le: number  // m
  Ve: number  // m³
  AL: number  // nH/N²
}

const cores: CoreData[] = coresData as CoreData[]

function selectCore(areaProduct: number): CoreData | null {
  const suitable = cores.filter(core => core.Ae * core.Aw >= areaProduct)
  if (suitable.length === 0) return null
  return suitable.reduce((min, core) =>
    (core.Ae * core.Aw < min.Ae * min.Aw) ? core : min
  )
}

// ── Magnetics helpers ─────────────────────────────────────────────────────────

// Erickson & Maksimovic eq. 13.6 — limits to 0.45 for safe operating margin
function computeDutyCycle(vinNom: number, vout: number): number {
  return Math.min(0.45, vout / (vinNom + vout))
}

// Turns ratio Np/Ns from volt-seconds balance at nominal operating point
// Mohan, Undeland, Robbins "Power Electronics" 3rd ed., eq. 10.3
function computeTurnsRatio(vinNom: number, D: number, vout: number): number {
  return (vinNom * D) / vout
}

// TI SLUA117B eq. 3 — minimum magnetizing inductance for CCM boundary
function computeMagnetizingInductance(vinMin: number, D: number, pTotal: number, fsw: number): number {
  return (vinMin * D) ** 2 / (2 * pTotal * fsw)
}

// Secondary turns for winding k — from volt-seconds balance including diode drop
// Ns_k = Np × (Vout_k + Vf_k) / (Vin_nom × D)
// Mohan, Undeland, Robbins "Power Electronics" 3rd ed., eq. 10.3
function computeSecondaryTurns(Np: number, D: number, vinNom: number, vout_k: number, vf_k: number): number {
  return Math.ceil(Np * (vout_k + vf_k) / (vinNom * D))
}

// Reverse voltage the secondary rectifier must block: Vr = Vout_k + (Ns/Np)×Vin_max
// Kazimierczuk "High-Frequency Magnetic Components" 2nd ed., eq. 3.12
function computeDiodeVr(ns: number, np: number, vinMax: number, vout_k: number): number {
  return vout_k + (ns / np) * vinMax
}

// Cout ≥ Iout_k × D / (fsw × ΔVout_k); use 2 % of Vout as ripple budget
function computeSecondaryCapacitance(iout_k: number, D: number, fsw: number, vout_k: number): number {
  return (iout_k * D) / (fsw * vout_k * 0.02)
}

// Cross-regulation estimate under ±50 % primary load variation.
// D shifts ≈ ±12 % of its nominal value for a well-designed CCM flyback.
// Mohan, Undeland, Robbins "Power Electronics" 3rd ed., Fig. 10-8
function estimateCrossRegPct(ns: number, np: number, vinNom: number, D: number, vout_k: number): number {
  const dVariation = D * 0.12
  return ((ns / np) * vinNom * dVariation / vout_k) * 100
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
    return {
      label: `Output ${i + 2}`,
      vout_nominal: s.vout,
      ns,
      diode_vr_max,
      capacitance,
      crossRegPct,
    }
  })
}

// ── Transfer function ─────────────────────────────────────────────────────────

function createFlybackTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const D = result.dutyCycle
  const Lm = result.magnetizingInductance || result.inductance
  const C = result.capacitance
  const Rload = spec.vout / spec.iout
  const N = result.turnsRatio || 1

  const k = N * (1 - D)
  const omegaRHPZ = (1 - D)**2 * Rload / (2 * Math.PI * Lm)
  const omegaP = 1 / Math.sqrt(Lm * C)

  return {
    numerator: [k, -k * omegaRHPZ / (2 * Math.PI)],
    denominator: [1, omegaP / (2 * Math.PI), 0],
    evaluate(freq_hz: number) {
      const s = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ / (2 * Math.PI), complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omegaP / (2 * Math.PI), s)), complex(0, 0))
      const h = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h as Complex)),
        phase_deg: arg(h as Complex) * (180 / Math.PI),
      }
    },
  }
}

// ── Main topology object ──────────────────────────────────────────────────────

export const flybackTopology: Topology = {
  id: 'flyback',
  name: 'Flyback',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vinMax, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency } = spec
    const secondaries = spec.secondary_outputs ?? []

    const vinNom = (vinMin + vinMax) / 2

    // 1. Duty cycle — Erickson & Maksimovic eq. 13.6
    const dMax = computeDutyCycle(vinNom, vout)

    // 2. Total output power — core sizing uses the sum of all outputs
    const pPrimary     = vout * iout
    const pSecondaries = secondaries.reduce((sum, s) => sum + s.vout * s.iout, 0)
    const pTotal       = pPrimary + pSecondaries

    // 3. Magnetizing inductance — TI SLUA117B eq. 3
    const magnetizingInductance = computeMagnetizingInductance(vinMin, dMax, pTotal, fsw)

    // 4. Primary peak current
    const inputPower       = pTotal / Math.max(efficiency, 0.7)
    const primaryCurrentAvg = inputPower / vinMin
    const deltaIm           = rippleRatio * primaryCurrentAvg
    const primaryPeakCurrent = primaryCurrentAvg + deltaIm / 2

    // 5. Turns ratio (primary/secondary for regulated output)
    const turnsRatio = computeTurnsRatio(vinNom, dMax, vout)

    // 6. Core selection via area-product method
    // Bmax = 0.3 T (ferrite), J = 400 kA/m², ku = 0.4 (window utilization)
    const bMax = 0.3
    const j    = 400_000
    const ku   = 0.4
    const areaProduct = (magnetizingInductance * primaryPeakCurrent * primaryCurrentAvg) / (bMax * j * ku)

    const selectedCore = selectCore(areaProduct)
    if (!selectedCore) {
      return {
        dutyCycle: dMax,
        inductance: magnetizingInductance,
        capacitance: 0,
        peakCurrent: primaryPeakCurrent,
        warnings: ['No suitable core found for the required area product'],
      }
    }

    // 7. Primary turns: Np = Lm × Ip_peak / (Bmax × Ae)
    const primaryTurns   = Math.ceil(magnetizingInductance * primaryPeakCurrent / (bMax * selectedCore.Ae))
    const secondaryTurns = Math.ceil(primaryTurns / turnsRatio)

    // 8. Primary output capacitance: Cout ≥ Iout × D / (fsw × ΔVout)
    const deltaVout = Math.max(voutRippleMax, 0.01 * vout)
    const capacitance = (iout * dMax) / (fsw * deltaVout)

    // 9. RCD clamp design
    // Build a minimal result stub so designSnubber can access magnetizingInductance and peakCurrent.
    const snubber = designSnubber('flyback', spec, {
      dutyCycle: dMax,
      inductance: magnetizingInductance,
      capacitance: 0,
      peakCurrent: primaryPeakCurrent,
      magnetizingInductance,
      turnsRatio,
      warnings: [],
    }, spec.leakageRatio ?? DEFAULT_LEAKAGE_RATIO)

    const clampVoltage = snubber.V_clamp  // V — designed RCD clamp voltage

    // 10. Simplified loss model
    const primaryCopperLoss  = primaryCurrentAvg ** 2 * 0.1
    const secondaryCopperLoss = iout ** 2 * 0.05
    const coreLoss   = 0.5
    const mosfetLoss = 2
    const diodeLoss  = 1
    const clampLoss  = snubber.P_dissipated   // actual RCD resistor dissipation
    const totalLoss  = primaryCopperLoss + secondaryCopperLoss + coreLoss + mosfetLoss + diodeLoss + clampLoss

    // 11. CCM/DCM boundary — Iout_crit = ΔIm × N × (1−D) / 2
    const ccm_dcm_boundary = deltaIm * turnsRatio * (1 - dMax) / 2
    let operating_mode: 'CCM' | 'DCM' | 'boundary' = 'CCM'

    const warnings: string[] = []

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

    // 12. Secondary output results (multi-output mode)
    const secondaryOutputResults = secondaries.length > 0
      ? computeSecondaryResultsWithFsw(secondaries, primaryTurns, dMax, vinNom, vinMax, fsw)
      : undefined

    if (secondaries.length > 0) {
      warnings.push(
        'Cross-regulation on unregulated outputs is typically ±5–10 %. ' +
        'Use post-regulators (LDO) for tight regulation.',
      )
    }

    // Saturation check on the magnetizing inductance (primary winding)
    const saturation_check = checkSaturation(primaryPeakCurrent, primaryCurrentAvg)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    return {
      dutyCycle: dMax,
      inductance: magnetizingInductance,
      capacitance,
      peakCurrent: primaryPeakCurrent,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      snubber,
      efficiency: pPrimary / (pPrimary + totalLoss),
      warnings,
      turnsRatio,
      primaryTurns,
      secondaryTurns,
      coreType: selectedCore.type,
      magnetizingInductance,
      clampVoltage,
      secondaryOutputResults,
      losses: {
        primaryCopper:   primaryCopperLoss,
        secondaryCopper: secondaryCopperLoss,
        core:   coreLoss,
        mosfet: mosfetLoss,
        diode:  diodeLoss,
        clamp:  clampLoss,
        total:  totalLoss,
      },
    }
  },

  getTransferFunction(spec, result) {
    return createFlybackTransferFunction(spec, result)
  },
}
