import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import { DesignSpec, DesignResult, Topology, TransferFunction } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { designSnubber, DEFAULT_LEAKAGE_RATIO } from '../snubber'
import { selectCore } from './core-selector'
import type { CoreData } from './core-selector'

// ── Transfer function ─────────────────────────────────────────────────────────

// Buck-derived topology → LC double pole only, no RHP zero.
// H(s) = K·ω₀² / (s² + (ω₀/Q)·s + ω₀²)
// Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §8.2.3.
function createForwardTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const Lo    = result.outputInductance ?? result.inductance
  const C     = result.capacitance
  const D     = result.dutyCycle
  const Rload = spec.vout / spec.iout

  const k_dc  = spec.vout / D                          // Erickson eq. 8.37: DC gain K = Vout/D
  const omega0 = 1 / Math.sqrt(Lo * C)                 // Erickson eq. 8.38: ω₀ = 1/√(Lo·Cout)
  const Q     = Rload * Math.sqrt(C / Lo)              // Q = R_load·√(Cout/Lo)

  return {
    numerator:   [k_dc * omega0 ** 2],
    denominator: [1, omega0 / Q, omega0 ** 2],
    evaluate(freq_hz: number) {
      const s   = complex(0, 2 * Math.PI * freq_hz)
      const num = complex(k_dc * omega0 ** 2, 0)
      const den = add(add(multiply(s, s), multiply(omega0 / Q, s)), complex(omega0 ** 2, 0))
      const h   = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h as Complex)),
        phase_deg:    arg(h as Complex) * (180 / Math.PI),
      }
    },
  }
}

// ── Compute helpers ───────────────────────────────────────────────────────────

interface ForwardDuty {
  dutyCycle: number  // — — equals dMax (worst-case at Vin_min)
  dMax:      number  // — — RCD-constrained maximum duty cycle
  dMaxRcd:   number  // — — volt-second limit from reset network
  vClamp:    number  // V — RCD clamp voltage = 1.5 × Vin_max
}

/**
 * RCD-clamp duty cycle constraint for a single-switch forward converter.
 * Volt-second balance: D_max ≤ Vin_min / (Vin_min + Vclamp).
 * Hard cap of 0.45 prevents partial core reset.
 * Reference: TI SLUA101; Erickson & Maksimovic 3rd ed., §6.2.2.
 */
function computeForwardDuty(spec: DesignSpec): ForwardDuty {
  const { vinMin, vinMax } = spec
  const vClamp  = 1.5 * vinMax
  const dMaxRcd = vinMin / (vinMin + vClamp)
  const dMax    = Math.min(0.45, dMaxRcd)
  return { dutyCycle: dMax, dMax, dMaxRcd, vClamp }
}

interface ForwardOutputFilter {
  outputInductance: number  // H — Lo (post-rectifier filter inductor)
  deltaIL:          number  // A — inductor ripple
  IL_peak:          number  // A — inductor peak current
  IL_rms:           number  // A
  capacitance:      number  // F — output capacitor
  esr_max:          number  // Ω — maximum output cap ESR
  I_cout_rms:       number  // A
}

/**
 * Output filter (Lo and Cout) for the single-switch forward converter.
 * Post-rectifier stage is identical to a buck converter output filter.
 * Erickson & Maksimovic 3rd ed., §§6.3, 2.4.
 */
function computeOutputFilter(spec: DesignSpec, dutyCycle: number): ForwardOutputFilter {
  const { vout, iout, fsw, rippleRatio, voutRippleMax } = spec
  const rippleFactor = Math.max(rippleRatio, 0.1)
  const deltaIL      = rippleFactor * iout
  const outputInductance = (vout * (1 - dutyCycle)) / (fsw * deltaIL)
  const IL_peak      = iout + deltaIL / 2
  const IL_rms       = Math.sqrt(iout ** 2 + deltaIL ** 2 / 12)
  const deltaVout    = Math.max(voutRippleMax, 0.01 * vout)
  const capacitance  = deltaIL / (8 * fsw * deltaVout)
  const esr_max      = deltaVout / deltaIL
  const I_cout_rms   = deltaIL / (2 * Math.sqrt(3))
  return { outputInductance, deltaIL, IL_peak, IL_rms, capacitance, esr_max, I_cout_rms }
}

interface ForwardTransformer {
  turnsRatio:           number       // Np/Ns — ensures regulation at full duty
  primaryTurns:         number       // integer
  secondaryTurns:       number       // integer
  magnetizingInductance: number      // H
  selectedCore:         CoreData | null
  lmMin:                number       // H — minimum Lm from magnetising constraint
  deltaIm_target:       number       // A — target magnetising ripple (20% of Ip_avg)
}

/**
 * Transformer design for a single-switch forward converter.
 * Turns ratio: N = (Vin_min × D_max) / Vout — Erickson 3rd ed., Table 6-1.
 * Primary turns from both flux-density and inductance constraints; larger wins.
 * Core area-product method; Bmax = 0.3 T, J = 400 kA/m², ku = 0.4.
 */
function computeTransformer(spec: DesignSpec, dMax: number, primaryCurrentAvg: number): ForwardTransformer {
  const { vinMin, vout, fsw } = spec
  const turnsRatio     = (vinMin * dMax) / vout
  const deltaIm_target = 0.2 * primaryCurrentAvg

  // Lm ≥ Vin_min·D_max / (fsw·ΔIm_target) — Erickson §6.2.1
  const lmMin = (vinMin * dMax) / (fsw * deltaIm_target)

  const bMax = 0.3, j = 400_000, ku = 0.4
  const areaProduct = (lmMin * primaryCurrentAvg * (deltaIm_target / 2)) / (bMax * j * ku)
  const selectedCore = selectCore(areaProduct)

  // Np from flux density constraint: Np_flux = ceil(Vin·D / (Bmax·Ae·fsw))
  // Np from inductance constraint:   Np_Lm  = ceil(√(Lm_min / AL))
  const npFromFlux = selectedCore ? Math.ceil((vinMin * dMax) / (bMax * selectedCore.Ae * fsw)) : 10
  const npFromLm   = selectedCore ? Math.ceil(Math.sqrt(lmMin / (selectedCore.AL * 1e-9))) : 10
  const primaryTurns   = Math.max(npFromFlux, npFromLm)
  const secondaryTurns = Math.max(1, Math.round(primaryTurns / turnsRatio))
  const magnetizingInductance = selectedCore
    ? (selectedCore.AL * 1e-9) * primaryTurns ** 2
    : lmMin

  return { turnsRatio, primaryTurns, secondaryTurns, magnetizingInductance, selectedCore, lmMin, deltaIm_target }
}

interface ForwardRatings {
  primaryCurrentAvg: number  // A
  Ip_peak:           number  // A — primary peak current (Iout/N + ΔIm/2)
  I_cin_rms:         number  // A — input cap RMS current
  cin:               number  // F — minimum input capacitance (1% ripple)
  mosfetVdsMax:      number  // V — Vin_max + Vclamp
  diodeVrMax:        number  // V — secondary diode reverse voltage
  d1IfAvg:           number  // A — forward diode average current
  d2IfAvg:           number  // A — freewheel diode average current
}

/**
 * Primary and component voltage/current ratings for a forward converter.
 * MOSFET: Vds_max = Vin_max + Vclamp; secondary diodes: Vr ≈ Vin_max/N + Vout.
 * Erickson & Maksimovic 3rd ed., Table 6-1.
 */
function computeRatings(
  spec: DesignSpec,
  dutyCycle: number,
  dMax: number,
  turnsRatio: number,
  deltaIm_target: number,
  vClamp: number,
): ForwardRatings {
  const { vinMin, vinMax, vout, iout, fsw } = spec
  const pout             = vout * iout
  const eta              = Math.min(Math.max(spec.efficiency, 0.5), 1)
  const primaryCurrentAvg = (pout / eta) / vinMin
  const Ip_peak           = iout / turnsRatio + deltaIm_target
  const I_cin_rms         = Ip_peak * Math.sqrt(dutyCycle)
  const cin               = (primaryCurrentAvg * dMax) / (fsw * 0.01 * vinMin)
  const mosfetVdsMax      = vinMax + vClamp
  const diodeVrMax        = vinMax / turnsRatio + vout
  const d1IfAvg           = iout * dMax
  const d2IfAvg           = iout * (1 - dMax)
  return { primaryCurrentAvg, Ip_peak, I_cin_rms, cin, mosfetVdsMax, diodeVrMax, d1IfAvg, d2IfAvg }
}

/**
 * Loss breakdown for a single-switch forward converter.
 * Copper losses use DCR estimates; core and snubber losses use physics models.
 * Erickson & Maksimovic 3rd ed., §6.3.
 */
function computeForwardLosses(
  dutyCycle: number,
  dMax: number,
  primaryCurrentAvg: number,
  Ip_peak: number,
  IL_rms: number,
  d1IfAvg: number,
  d2IfAvg: number,
  mosfetVdsMax: number,
  snubber: { P_dissipated: number },
) {
  const I_primary_rms   = primaryCurrentAvg * Math.sqrt(dMax)
  const I_secondary_rms = IL_rms  // output inductor RMS current

  const primaryCopper      = I_primary_rms ** 2 * 0.1        // 100 mΩ primary DCR estimate
  const secondaryCopper    = I_secondary_rms ** 2 * 0.02     // 20 mΩ secondary DCR estimate
  const outputInductorLoss = IL_rms ** 2 * 0.01              // 10 mΩ Lo DCR estimate
  const coreLoss           = 0.8                             // W — Steinmetz placeholder
  const mosfetSwitching    = 0.5 * mosfetVdsMax * Ip_peak * 50e-9 * dutyCycle  // 25+25 ns
  const mosfetConduction   = I_primary_rms ** 2 * 0.05       // 50 mΩ Rds_on estimate
  const mosfetLoss         = mosfetSwitching + mosfetConduction
  const d1Loss             = 0.7 * d1IfAvg                   // 0.7 V Vf, Schottky estimate
  const d2Loss             = 0.7 * d2IfAvg
  const diodeLoss          = d1Loss + d2Loss
  const clampLoss          = snubber.P_dissipated
  const total = primaryCopper + secondaryCopper + outputInductorLoss +
                coreLoss + mosfetLoss + diodeLoss + clampLoss
  return { primaryCopper, secondaryCopper, outputInductorLoss, coreLoss, mosfetLoss, diodeLoss, clampLoss, total }
}

/**
 * All design rule warnings for a forward converter.
 * Includes CCM/DCM detection, duty-cycle reset margin, core saturation, and
 * the mandatory MOSFET / input-cap stress advisory.
 */
function computeForwardWarnings(
  spec: DesignSpec,
  dutyCycle: number,
  dMax: number,
  dMaxRcd: number,
  selectedCore: CoreData | null,
  snubber: { P_dissipated: number },
  pout: number,
  Ip_peak: number,
  primaryCurrentAvg: number,
  mosfetVdsMax: number,
  I_cin_rms: number,
  cin: number,
  ccm_dcm_boundary: number,
): { operating_mode: 'CCM' | 'DCM' | 'boundary'; warnings: string[] } {
  const { vinMin, vout, fsw } = spec
  const warnings: string[] = []
  let operating_mode: 'CCM' | 'DCM' | 'boundary' = 'CCM'

  if (spec.iout < ccm_dcm_boundary) {
    operating_mode = 'DCM'
    warnings.push('Operating in DCM. Equations assume CCM — results may be inaccurate. Increase inductance or load current to enter CCM.')
  } else if (spec.iout < 1.2 * ccm_dcm_boundary) {
    operating_mode = 'boundary'
    warnings.push('Near CCM/DCM boundary. Performance may be unpredictable at light loads.')
  }

  if (dutyCycle > 0.4)
    warnings.push(
      `Duty cycle ${(dutyCycle * 100).toFixed(1)}% is close to the reset limit ` +
      `(${(dMaxRcd * 100).toFixed(1)}%). Increase Vclamp or reduce Vin_max/Vin_min ratio.`
    )
  if (dMaxRcd < 0.45 && dMax < 0.3)
    warnings.push(
      `Reset mechanism limits D_max to ${(dMax * 100).toFixed(1)}%. ` +
      `Turns ratio N=${((vinMin * dMax) / vout).toFixed(2)} is designed for this limit.`
    )
  if (!selectedCore)
    warnings.push('No suitable transformer core found. Add larger cores or reduce Lm requirement.')

  if (selectedCore) {
    // Erickson §6.2.1: B_peak = Vin·D / (Np·Ae·fsw)
    const primaryTurns = Math.max(1, Math.ceil(Math.sqrt((vinMin * dMax) / (fsw * (selectedCore.AL * 1e-9)))))
    const bPeak = (vinMin * dMax) / (primaryTurns * selectedCore.Ae * fsw)
    if (bPeak > 0.3)
      warnings.push(
        `Transformer flux density ${(bPeak * 1000).toFixed(0)} mT exceeds 300 mT. ` +
        `Increase Np or choose a larger core.`
      )
  }

  if (Ip_peak > 3 * primaryCurrentAvg)
    warnings.push('High peak primary current — verify transformer core does not saturate.')

  warnings.push(
    `MOSFET must block Vin_max + Vclamp = ${Math.round(mosfetVdsMax)} V ` +
    `(use a ${Math.round(mosfetVdsMax * 1.25)} V-rated device with 25% margin). ` +
    `Input cap must handle ${I_cin_rms.toFixed(2)} A rms pulsed current ` +
    `(min Cin ≈ ${(cin * 1e6).toFixed(1)} µF).`
  )

  if (snubber.P_dissipated > 0.05 * pout)
    warnings.push(
      `RCD clamp dissipates ${snubber.P_dissipated.toFixed(1)} W ` +
      `(${((snubber.P_dissipated / pout) * 100).toFixed(0)} % of Pout). ` +
      `Reduce leakage ratio or switching frequency to lower clamp losses.`,
    )

  return { operating_mode, warnings }
}

// ── Main topology object ──────────────────────────────────────────────────────

/*
 * Single-switch forward converter with RCD clamp reset.
 *
 *  Q1 ON : S1 energises Lo via D1; D2 reverse-biased; V_A = Vin/N.
 *  Q1 OFF: RCD clamp resets core; D2 freewheels Lo; V_A ≈ 0.
 *  MOSFET Vds_max = Vin_max + Vclamp; diodes Vr ≈ Vin_max/N + Vout.
 */
export const forwardTopology: Topology = {
  id: 'forward',
  name: 'Forward',

  compute(spec: DesignSpec): DesignResult {
    const { vout, iout } = spec

    const { dutyCycle, dMax, dMaxRcd, vClamp } = computeForwardDuty(spec)
    const filter = computeOutputFilter(spec, dutyCycle)
    const { outputInductance, deltaIL, IL_peak, IL_rms, capacitance, esr_max, I_cout_rms } = filter

    const pout             = vout * iout
    const eta              = Math.min(Math.max(spec.efficiency, 0.5), 1)
    const primaryCurrentAvg = (pout / eta) / spec.vinMin

    const tx = computeTransformer(spec, dMax, primaryCurrentAvg)
    const { turnsRatio, primaryTurns, secondaryTurns, magnetizingInductance, selectedCore, deltaIm_target } = tx

    const ratings = computeRatings(spec, dutyCycle, dMax, turnsRatio, deltaIm_target, vClamp)
    const { Ip_peak, I_cin_rms, cin, mosfetVdsMax, diodeVrMax, d1IfAvg, d2IfAvg } = ratings

    const snubber = designSnubber('forward', spec, {
      dutyCycle, inductance: magnetizingInductance, capacitance: 0,
      peakCurrent: IL_peak, magnetizingInductance, turnsRatio, warnings: [],
    }, spec.leakageRatio ?? DEFAULT_LEAKAGE_RATIO)

    const lossBreakdown = computeForwardLosses(
      dutyCycle, dMax, primaryCurrentAvg, Ip_peak, IL_rms,
      d1IfAvg, d2IfAvg, mosfetVdsMax, snubber,
    )

    const ccm_dcm_boundary = deltaIL * (1 - dutyCycle) / 2
    const { operating_mode, warnings } = computeForwardWarnings(
      spec, dutyCycle, dMax, dMaxRcd, selectedCore, snubber, pout,
      Ip_peak, primaryCurrentAvg, mosfetVdsMax, I_cin_rms, cin, ccm_dcm_boundary,
    )

    const saturation_check = checkSaturation(IL_peak, iout)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    return {
      dutyCycle,
      inductance:  outputInductance,
      capacitance,
      peakCurrent: IL_peak,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      snubber,
      inductor:   { value: outputInductance, peak_current: IL_peak, rms_current: IL_rms },
      output_cap: { value: capacitance, esr_max, ripple_current: I_cout_rms },
      efficiency:  pout / (pout + lossBreakdown.total),
      warnings,
      turnsRatio,
      primaryTurns,
      secondaryTurns,
      coreType:    selectedCore?.type,
      magnetizingInductance,
      resetVoltage: snubber.V_clamp,
      rectifierDiodes: 2,
      outputInductance,
      mosfetVdsMax,
      diodeVrMax,
      losses: {
        primaryCopper:   lossBreakdown.primaryCopper,
        secondaryCopper: lossBreakdown.secondaryCopper + lossBreakdown.outputInductorLoss,
        core:   lossBreakdown.coreLoss,
        mosfet: lossBreakdown.mosfetLoss,
        diode:  lossBreakdown.diodeLoss,
        clamp:  lossBreakdown.clampLoss,
        total:  lossBreakdown.total,
      },
    }
  },

  getTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
    return createForwardTransferFunction(spec, result)
  },
}
