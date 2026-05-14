import { DesignSpec, DesignResult, Topology } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { buildLosses, detectCcmDcm, calcEfficiency } from './result-utils'
import { createBuckBoostTransferFunction } from './buck-boost/tf'
import { computeBuckBoostOperatingPoint } from './buck-boost/operating-point'
import { computeBuckBoostLosses } from './buck-boost/losses'
import { computeBuckBoostWarnings } from './buck-boost/warnings'

export const buckBoostTopology: Topology = {
  id: 'buck-boost',
  name: 'Buck-Boost',

  compute(spec: DesignSpec): DesignResult {
    const op = computeBuckBoostOperatingPoint(spec)
    const { dutyCycle, IL_dc, deltaIL, inductance, IL_peak, IL_rms,
            mosfetVdsMax, diodeVrMax, capacitance, esr_max, I_cout_rms, I_cin_rms, cin } = op

    const lossComps = computeBuckBoostLosses(spec, dutyCycle, IL_peak, IL_rms, deltaIL, mosfetVdsMax, I_cout_rms, IL_dc)
    const totalLoss =
      lossComps.mosfet_conduction + lossComps.mosfet_switching + lossComps.mosfet_gate +
      lossComps.inductor_copper   + lossComps.inductor_core    + lossComps.diode_conduction +
      lossComps.sync_conduction   + lossComps.sync_dead_time   + lossComps.capacitor_esr
    const efficiency = calcEfficiency(Math.abs(spec.vout) * spec.iout, totalLoss)

    const ccm_dcm_boundary = deltaIL * (1 - dutyCycle) / 2
    const { operating_mode, warnings: ccmWarn } = detectCcmDcm(spec.iout, ccm_dcm_boundary)
    const warnings = [
      ...ccmWarn,
      ...computeBuckBoostWarnings(spec, dutyCycle, inductance, IL_peak, IL_dc, mosfetVdsMax, I_cin_rms, cin),
    ]

    const saturation_check = checkSaturation(IL_peak, IL_dc)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    return {
      dutyCycle,
      inductance,
      capacitance,
      peakCurrent: IL_peak,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      inductor:   { value: inductance,  peak_current: IL_peak, rms_current: IL_rms },
      output_cap: { value: capacitance, esr_max, ripple_current: I_cout_rms },
      efficiency,
      losses: buildLosses(lossComps),
      mosfetVdsMax,
      diodeVrMax,
      warnings,
    }
  },

  getTransferFunction(spec: DesignSpec, result: DesignResult) {
    return createBuckBoostTransferFunction(spec, result)
  },
}
