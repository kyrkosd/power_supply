import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import { DesignSpec, DesignResult, Topology } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { RDS_ON, T_RISE, T_FALL, QG, VF, DCR, ESR, CORE_F, RDS_SYNC, T_DEAD, COSS_S, QG_S, VF_BODY } from '../device-assumptions'
import { buildDesignResult, normalizeDuty, detectCcmDcm, calcEfficiency } from './result-utils'

// ── Transfer function ─────────────────────────────────────────────────────────

// Erickson & Maksimovic 3rd ed., §8.2.1 — boost control-to-output.
// Double pole at ω₀ = 1/√(LC); RHP zero at frhpz = (1-D)²·R / (2π·L).
function createTransferFunction(spec: DesignSpec, result: DesignResult) {
  const D  = result.dutyCycle
  const L  = result.inductance
  const C  = result.capacitance
  const Rload = spec.vout / spec.iout
  const k     = spec.vout / (1 - D)
  const frhpz = ((1 - D) ** 2 * Rload) / (2 * Math.PI * L)
  const omegaRHPZ = 2 * Math.PI * frhpz
  const omega0    = 1 / Math.sqrt(L * C)

  return {
    numerator:   [k, -k * omegaRHPZ],
    denominator: [1, omega0, 0],
    evaluate(freq_hz: number) {
      const s   = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ, complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omega0, s)), complex(0, 0))
      const h   = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h as Complex)),
        phase_deg:    arg(h as Complex) * (180 / Math.PI),
      }
    },
  }
}

// ── Section helpers ───────────────────────────────────────────────────────────

interface BoostOperatingPoint {
  dutyCycle:    number  // —
  inputCurrent: number  // A — continuous inductor (= input) current
  deltaIL:      number  // A — inductor ripple
  inductance:   number  // H
  peakCurrent:  number  // A
  capacitance:  number  // F
}

/**
 * Duty cycle and passive-component sizes for a CCM boost converter.
 * L = Vin·D / (fsw·ΔIL); Cout = Iout·D / (fsw·ΔVout).
 * Erickson & Maksimovic 3rd ed., §2.3.
 */
function computeOperatingPoint(spec: DesignSpec): BoostOperatingPoint {
  const { vinMin, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency: etaSpec } = spec

  // D = 1 − (Vin·η) / Vout
  const rawDuty     = 1 - (vinMin * Math.min(Math.max(etaSpec, 0.5), 1)) / vout
  const dutyCycle   = normalizeDuty(rawDuty)

  // Input current is continuous: Iin = Iout / (1−D)
  const inputCurrent = iout / (1 - dutyCycle)
  const rippleFactor = Math.max(rippleRatio, 0.1)
  const deltaIL      = rippleFactor * inputCurrent
  const inductance   = (vinMin * dutyCycle) / (fsw * deltaIL)
  const peakCurrent  = inputCurrent + deltaIL / 2

  // Output cap: pulsed diode current requires Cout ≥ Iout·D / (fsw·ΔVout)
  const deltaVout   = Math.max(voutRippleMax, 0.01 * vout)
  const capacitance = (iout * dutyCycle) / (fsw * deltaVout)

  return { dutyCycle, inputCurrent, deltaIL, inductance, peakCurrent, capacitance }
}

/**
 * Loss breakdown for a CCM boost.
 * Control MOSFET conducts during D; output diode / sync FET conducts during (1-D).
 * TI SLUA618 eq. 3 for MOSFET switching losses.
 */
function computeLosses(
  spec: DesignSpec,
  dutyCycle: number,
  inputCurrent: number,
  deltaIL: number,
  peakCurrent: number,
) {
  const { vinMin, vout, iout, fsw } = spec
  const syncMode = spec.rectification === 'synchronous'
  const I_L_rms  = Math.sqrt(inputCurrent ** 2 + deltaIL ** 2 / 12)

  const mosfet_conduction = RDS_ON * I_L_rms ** 2 * dutyCycle
  // TI SLUA618 eq. 3: P_sw = 0.5 × Vin × Ipeak × (tr + tf) × fsw
  const mosfet_switching  = 0.5 * vinMin * peakCurrent * (T_RISE + T_FALL) * fsw
  const mosfet_gate       = QG * vout * fsw

  const inductor_copper = DCR * I_L_rms ** 2
  const inductor_core   = CORE_F * inputCurrent * deltaIL

  // Output diode carries Iout during (1-D)
  const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)

  // Sync FET replaces output diode: P = Rds × I_rms² × (1-D)
  const sync_conduction = syncMode
    ? RDS_SYNC * I_L_rms ** 2 * (1 - dutyCycle)
    : 0

  // Dead-time + Coss charge + gate overhead (2 transitions per period)
  const sync_dead_time = syncMode
    ? VF_BODY * inputCurrent * 2 * T_DEAD * fsw
      + 0.5 * COSS_S * vout ** 2 * fsw
      + QG_S * vout * fsw
    : 0

  // Output cap ESR: Ic_rms = Iout × √(D / (1-D))
  const Ic_rms      = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))
  const capacitor_esr = Ic_rms ** 2 * ESR

  return {
    mosfet_conduction, mosfet_switching, mosfet_gate,
    inductor_copper,   inductor_core,
    diode_conduction,  sync_conduction,  sync_dead_time,
    capacitor_esr,
  }
}

/**
 * Design rule warnings for a boost converter.
 * Checks duty-cycle extremes, RHPZ proximity, and inductor peak stress.
 * Erickson & Maksimovic §8.2.1 for RHPZ threshold.
 */
function computeWarnings(
  spec: DesignSpec,
  dutyCycle: number,
  inductance: number,
  peakCurrent: number,
): string[] {
  const { fsw, vout, iout } = spec
  const warnings: string[] = []

  if (dutyCycle >= 0.9)
    warnings.push('Boost duty cycle exceeds 90% and may reduce efficiency and control margin.')
  if (dutyCycle <= 0.1)
    warnings.push('Boost duty cycle is below 10% and the converter may be sensitive to noise.')
  if (peakCurrent > 3 * iout)
    warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')

  const rload = vout / iout
  const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
  if (frhpz > 0 && fsw / 10 > frhpz / 3)
    warnings.push(`Right-half-plane zero at ${Math.round(frhpz)} Hz may limit crossover to less than one-third of the RHPZ frequency.`)

  return warnings
}

// ── Topology export ───────────────────────────────────────────────────────────

export const boostTopology: Topology = {
  id: 'boost',
  name: 'Boost (Step-Up)',

  compute(spec: DesignSpec): DesignResult {
    const op = computeOperatingPoint(spec)
    const { dutyCycle, inputCurrent, deltaIL, inductance, peakCurrent, capacitance } = op

    const ccm_dcm_boundary = deltaIL * (1 - dutyCycle) / 2
    const { operating_mode, warnings: ccmWarn } = detectCcmDcm(spec.iout, ccm_dcm_boundary)
    const warnings = [...ccmWarn, ...computeWarnings(spec, dutyCycle, inductance, peakCurrent)]

    const saturation_check = checkSaturation(peakCurrent, inputCurrent)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    const lossComps = computeLosses(spec, dutyCycle, inputCurrent, deltaIL, peakCurrent)
    const totalLoss =
      lossComps.mosfet_conduction + lossComps.mosfet_switching + lossComps.mosfet_gate +
      lossComps.inductor_copper   + lossComps.inductor_core    + lossComps.diode_conduction +
      lossComps.sync_conduction   + lossComps.sync_dead_time   + lossComps.capacitor_esr
    const efficiency = calcEfficiency(spec.vout * spec.iout, totalLoss)

    return buildDesignResult({
      dutyCycle, inductance, capacitance, peakCurrent, efficiency,
      ccm_dcm_boundary, operating_mode, saturation_check,
      losses: lossComps, warnings,
    })
  },

  getTransferFunction(spec, result) {
    return createTransferFunction(spec, result)
  },
}
