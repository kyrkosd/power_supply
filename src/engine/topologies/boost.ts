import { DesignSpec, DesignResult, Topology } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { buildDesignResult, detectCcmDcm, calcEfficiency } from './result-utils'
import { createBoostTransferFunction } from './boost/tf'
import { computeBoostOperatingPoint } from './boost/operating-point'
import { computeBoostLosses } from './boost/losses'
import { computeBoostWarnings } from './boost/warnings'

export const boostTopology: Topology = {
  id: 'boost',
  name: 'Boost (Step-Up)',

  compute(spec: DesignSpec): DesignResult {
    const op = computeBoostOperatingPoint(spec)
    const { dutyCycle, inputCurrent, deltaIL, inductance, peakCurrent, capacitance } = op

    const ccm_dcm_boundary = deltaIL * (1 - dutyCycle) / 2
    const { operating_mode, warnings: ccmWarn } = detectCcmDcm(spec.iout, ccm_dcm_boundary)
    const warnings = [...ccmWarn, ...computeBoostWarnings(spec, dutyCycle, inductance, peakCurrent)]

    const saturation_check = checkSaturation(peakCurrent, inputCurrent)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    const lossComps = computeBoostLosses(spec, dutyCycle, inputCurrent, deltaIL, peakCurrent)
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
    return createBoostTransferFunction(spec, result)
  },
}
