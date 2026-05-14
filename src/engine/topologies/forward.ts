import { DesignSpec, DesignResult, Topology, TransferFunction } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { designSnubber, DEFAULT_LEAKAGE_RATIO } from '../snubber'
import { createForwardTransferFunction } from './forward/tf'
import { computeForwardDuty } from './forward/duty'
import { computeOutputFilter } from './forward/filter'
import { computeTransformer } from './forward/transformer'
import { computeRatings } from './forward/ratings'
import { computeForwardLosses } from './forward/losses'
import { computeForwardWarnings } from './forward/warnings'

export const forwardTopology: Topology = {
  id: 'forward',
  name: 'Forward',

  compute(spec: DesignSpec): DesignResult {
    const { vout, iout } = spec

    const { dutyCycle, dMax, dMaxRcd, vClamp } = computeForwardDuty(spec)
    const filter = computeOutputFilter(spec, dutyCycle)
    const { outputInductance, deltaIL, IL_peak, IL_rms, capacitance, esr_max, I_cout_rms } = filter

    const pout               = vout * iout
    const eta                = Math.min(Math.max(spec.efficiency, 0.5), 1)
    const primaryCurrentAvg  = (pout / eta) / spec.vinMin

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
