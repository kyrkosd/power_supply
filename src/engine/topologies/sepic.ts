import { DesignSpec, DesignResult, Topology } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { RDS_ON, T_RISE, T_FALL, QG, VF, DCR, ESR, CORE_F, RDS_SYNC, T_DEAD, COSS_S, QG_S, VF_BODY } from '../device-assumptions'
import { buildLosses, detectCcmDcm, calcEfficiency } from './result-utils'

// ── Section helpers ────────────────────────────────────────────────────────────

interface SepicOperatingPoint {
  dutyCycle:       number  // —
  inputCurrentAvg: number  // A — average L1 (input) current
  deltaIL1:        number  // A — L1 ripple (40 % of Iin, per TI AN-1484)
  inputInductance: number  // H — L1
  outputInductance: number // H — L2, equals L1 for coupled design
  pout:            number  // W
}

/**
 * Duty cycle and inductor sizing for a CCM SEPIC.
 * D = Vout / (Vin + Vout) — Erickson & Maksimovic 3rd ed., §11.3.
 * TI AN-1484 recommends 40 % ripple on the input (L1) current.
 */
function computeOperatingPoint(spec: DesignSpec): SepicOperatingPoint {
  const { vinMin, vinMax, vout, iout, fsw, efficiency } = spec
  const vinNom = (vinMin + vinMax) / 2

  const rawDuty = vout / (vinNom + vout)
  const dutyCycle = Math.min(Math.max(rawDuty, 0.05), 0.95)

  const pout = vout * iout
  const inputCurrentAvg = (pout / Math.max(efficiency, 0.8)) / vinNom
  const deltaIL1 = 0.4 * inputCurrentAvg
  const inputInductance = (vinNom * dutyCycle) / (fsw * deltaIL1)

  return { dutyCycle, inputCurrentAvg, deltaIL1, inputInductance, outputInductance: inputInductance, pout }
}

interface SepicCapacitors {
  couplingCapacitance:    number  // F — Cc, DC voltage = Vin
  couplingCapRmsCurrent:  number  // A
  outputCapacitance:      number  // F — Cout
  outputCapRmsCurrent:    number  // A
}

/**
 * Coupling and output capacitor sizing for a SEPIC.
 * Coupling cap: 10 % ripple budget on Vin; output cap: same structure as boost.
 */
function computeCapacitors(spec: DesignSpec, dutyCycle: number, iout: number): SepicCapacitors {
  const { vinMin, vinMax, vout, fsw, voutRippleMax } = spec
  const vinNom = (vinMin + vinMax) / 2

  const couplingCapacitance    = (iout * dutyCycle) / (fsw * 0.1 * vinNom)
  const couplingCapRmsCurrent  = iout * Math.sqrt(dutyCycle * (1 - dutyCycle))

  const deltaVout = Math.max(voutRippleMax, 0.01 * vout)
  const outputCapacitance   = (iout * dutyCycle) / (fsw * deltaVout)
  const outputCapRmsCurrent = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))

  return { couplingCapacitance, couplingCapRmsCurrent, outputCapacitance, outputCapRmsCurrent }
}

/**
 * Loss breakdown for a SEPIC.
 * Switch node voltage = Vin + Vout for both MOSFET and diode.
 * TI SLUA618 eq. 3 for switching losses.
 */
function computeLosses(
  spec: DesignSpec,
  dutyCycle: number,
  inputCurrentAvg: number,
  deltaIL1: number,
  peakInputCurrent: number,
  mosfetVdsMax: number,
  couplingCapRmsCurrent: number,
  outputCapRmsCurrent: number,
) {
  const { iout, fsw } = spec
  const vinNom = (spec.vinMin + spec.vinMax) / 2
  const syncMode = spec.rectification === 'synchronous'

  const I_sw_avg = inputCurrentAvg + iout
  const IL1_rms  = Math.sqrt(inputCurrentAvg ** 2 + deltaIL1 ** 2 / 12)
  const I_sw_rms = IL1_rms * Math.sqrt(dutyCycle)

  const mosfet_conduction = RDS_ON * I_sw_rms ** 2
  const mosfet_switching  = 0.5 * mosfetVdsMax * peakInputCurrent * (T_RISE + T_FALL) * fsw
  const mosfet_gate       = QG * vinNom * fsw

  // Both inductors have copper losses
  const inductor_copper = DCR * (IL1_rms ** 2 + iout ** 2)
  const inductor_core   = CORE_F * (inputCurrentAvg * deltaIL1 + iout * (0.4 * iout))

  const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)

  // Sync FET carries output current during (1-D)
  const sync_conduction = syncMode ? RDS_SYNC * iout ** 2 * (1 - dutyCycle) : 0
  const sync_dead_time  = syncMode
    ? VF_BODY * I_sw_avg * 2 * T_DEAD * fsw
      + 0.5 * COSS_S * mosfetVdsMax ** 2 * fsw
      + QG_S * mosfetVdsMax * fsw
    : 0

  // Coupling cap ESR (0.1 Ω estimate) + output cap ESR
  const capacitor_esr = couplingCapRmsCurrent ** 2 * 0.1 + outputCapRmsCurrent ** 2 * ESR

  return {
    mosfet_conduction, mosfet_switching, mosfet_gate,
    inductor_copper,   inductor_core,
    diode_conduction,  sync_conduction,  sync_dead_time,
    capacitor_esr,
  }
}

/** Design rule checks for SEPIC — topology selection guidance and coupling cap stress. */
function computeWarnings(dutyCycle: number, couplingCapRmsCurrent: number, iout: number): string[] {
  const warnings: string[] = []
  if (dutyCycle > 0.8)
    warnings.push('SEPIC duty cycle >80% - consider boost topology instead')
  if (dutyCycle < 0.2)
    warnings.push('SEPIC duty cycle <20% - consider buck topology instead')
  if (couplingCapRmsCurrent > 2 * iout)
    warnings.push('High coupling capacitor ripple current - use low-ESR capacitor')
  return warnings
}

// ── Topology export ────────────────────────────────────────────────────────────

export const sepicTopology: Topology = {
  id: 'sepic',
  name: 'SEPIC',

  compute(spec: DesignSpec): DesignResult {
    const op = computeOperatingPoint(spec)
    const { dutyCycle, inputCurrentAvg, deltaIL1, inputInductance, outputInductance, pout } = op

    const peakInputCurrent = inputCurrentAvg + deltaIL1 / 2
    const mosfetVdsMax     = spec.vinMax + spec.vout
    const diodeVrMax       = spec.vinMax + spec.vout

    const caps = computeCapacitors(spec, dutyCycle, spec.iout)
    const { couplingCapacitance, couplingCapRmsCurrent, outputCapacitance, outputCapRmsCurrent } = caps

    const ccm_dcm_boundary = deltaIL1 * (1 - dutyCycle) / 2
    const { operating_mode, warnings } = detectCcmDcm(spec.iout, ccm_dcm_boundary)
    warnings.push(...computeWarnings(dutyCycle, couplingCapRmsCurrent, spec.iout))

    const saturation_check = checkSaturation(peakInputCurrent, inputCurrentAvg)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    const lossComps = computeLosses(
      spec, dutyCycle, inputCurrentAvg, deltaIL1,
      peakInputCurrent, mosfetVdsMax, couplingCapRmsCurrent, outputCapRmsCurrent,
    )
    const totalLoss =
      lossComps.mosfet_conduction + lossComps.mosfet_switching + lossComps.mosfet_gate +
      lossComps.inductor_copper   + lossComps.inductor_core    + lossComps.diode_conduction +
      lossComps.sync_conduction   + lossComps.sync_dead_time   + lossComps.capacitor_esr

    return {
      dutyCycle,
      inductance:   inputInductance,
      capacitance:  outputCapacitance,
      peakCurrent:  peakInputCurrent,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      efficiency:   calcEfficiency(pout, totalLoss),
      warnings,
      outputInductance,
      couplingCapacitance,
      mosfetVdsMax,
      diodeVrMax,
      losses: buildLosses(lossComps),
    }
  },
}
