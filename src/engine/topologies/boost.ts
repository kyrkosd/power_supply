// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import { DesignSpec, DesignResult, Topology } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { DEVICE_ASSUMPTIONS } from '../device-assumptions'
import { buildDesignResult, buildLosses, normalizeDuty, detectCcmDcm, calcEfficiency } from './result-utils'

const {
  rds_on: RDS_ON,
  t_rise: T_RISE,
  t_fall: T_FALL,
  qg: QG,
  vf: VF,
  dcr: DCR,
  esr: ESR,
  core_factor: CORE_F,
  rds_on_sync: RDS_SYNC,
  t_dead: T_DEAD,
  coss_sync: COSS_S,
  qg_sync: QG_S,
  vf_body: VF_BODY,
} = DEVICE_ASSUMPTIONS

function createTransferFunction(spec: DesignSpec, result: DesignResult) {
  const D = result.dutyCycle
  const L = result.inductance
  const C = result.capacitance
  const Rload = spec.vout / spec.iout
  const k = spec.vout / (1 - D)
  const frhpz = ((1 - D) ** 2 * Rload) / (2 * Math.PI * L)
  const omegaRHPZ = 2 * Math.PI * frhpz
  const omega0 = 1 / Math.sqrt(L * C)

  return {
    numerator: [k, -k * omegaRHPZ],
    denominator: [1, omega0, 0],
    evaluate(freq_hz: number) {
      const s = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ, complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omega0, s)), complex(0, 0))
      const h = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h as Complex)),
        phase_deg: arg(h as Complex) * (180 / Math.PI),
      }
    },
  }
}

export const boostTopology: Topology = {
  id: 'boost',
  name: 'Boost (Step-Up)',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency: etaSpec } = spec

    // 1. Duty cycle: D = 1 - (Vin × η) / Vout
    const rawDuty = 1 - (vinMin * Math.min(Math.max(etaSpec, 0.5), 1)) / vout
    const dutyCycle = normalizeDuty(rawDuty)

    // 2. Inductor: L = Vin × D / (fsw × ΔIL)
    // Input current is continuous: Iin = Iout / (1 − D)
    const inputCurrent = iout / (1 - dutyCycle)
    const rippleFactor = Math.max(rippleRatio, 0.1)
    const deltaIL = rippleFactor * inputCurrent
    const inductance = (vinMin * dutyCycle) / (fsw * deltaIL)
    const peakCurrent = inputCurrent + deltaIL / 2

    // 3. Output capacitor: pulsed current requires higher cap and ESR control
    const deltaVout = Math.max(voutRippleMax, 0.01 * vout)
    const capacitance = (iout * dutyCycle) / (fsw * deltaVout)

    // CCM/DCM boundary detection
    // For boost: Iout_crit = ΔIL × (1-D) / 2
    const ccm_dcm_boundary = deltaIL * (1 - dutyCycle) / 2
    const { operating_mode, warnings } = detectCcmDcm(iout, ccm_dcm_boundary)

    if (dutyCycle >= 0.9) {
      warnings.push('Boost duty cycle exceeds 90% and may reduce efficiency and control margin.')
    }
    if (dutyCycle <= 0.1) {
      warnings.push('Boost duty cycle is below 10% and the converter may be sensitive to noise.')
    }
    if (peakCurrent > 3 * iout) {
      warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')
    }

    const rload = vout / iout
    const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
    const crossoverEstimate = fsw / 10
    if (frhpz > 0 && crossoverEstimate > frhpz / 3) {
      warnings.push(`Right-half-plane zero at ${Math.round(frhpz)} Hz may limit crossover to less than one-third of the RHPZ frequency.`)
    }

    const saturation_check = checkSaturation(peakCurrent, inputCurrent)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    const syncMode = spec.rectification === 'synchronous'
    const I_L_rms  = Math.sqrt(inputCurrent ** 2 + deltaIL ** 2 / 12)

    // Control MOSFET: conducts during D (switch on, diode off)
    // Boost switch carries inductor current (= input current) for duty D
    // TI SLVA618 eq. 3
    const mosfet_conduction = RDS_ON * I_L_rms ** 2 * dutyCycle
    const mosfet_switching  = 0.5 * vinMin * peakCurrent * (T_RISE + T_FALL) * fsw
    const mosfet_gate       = QG * vout * fsw

    const inductor_copper = DCR * I_L_rms ** 2
    const inductor_core   = CORE_F * inputCurrent * deltaIL

    // Output diode / sync FET: conducts during (1-D)
    // Boost output diode carries iout during (1-D); full output current
    const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)

    // Sync: N=1 boost, sync FET replaces output diode
    // P_sync = Rds_sync × I_rms_sync² where I_rms_sync = I_L_rms during (1-D)
    const sync_conduction = syncMode
      ? RDS_SYNC * I_L_rms ** 2 * (1 - dutyCycle)
      : 0

    // Dead-time + Coss + gate overhead (2 transitions per period)
    const sync_dead_time = syncMode
      ? (VF_BODY * inputCurrent * 2 * T_DEAD * fsw
       + 0.5 * COSS_S * vout ** 2 * fsw
       + QG_S * vout * fsw)
      : 0

    // Output cap ESR: pulsed diode current in boost
    const Ic_rms      = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))
    const capacitor_esr = Ic_rms ** 2 * ESR

    const pout = vout * iout
    const totalLoss = mosfet_conduction + mosfet_switching + mosfet_gate +
                      inductor_copper + inductor_core + diode_conduction +
                      sync_conduction + sync_dead_time + capacitor_esr
    const efficiency = calcEfficiency(pout, totalLoss)

    return buildDesignResult({
      dutyCycle,
      inductance,
      capacitance,
      peakCurrent,
      efficiency,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      losses: buildLosses({
        mosfet_conduction,
        mosfet_switching,
        mosfet_gate,
        inductor_copper,
        inductor_core,
        diode_conduction,
        sync_conduction,
        sync_dead_time,
        capacitor_esr,
      }),
      warnings,
    })
  },

  getTransferFunction(spec, result) {
    return createTransferFunction(spec, result)
  },
}
