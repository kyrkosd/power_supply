import { DesignSpec, DesignResult, Topology } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { designSnubber, DEFAULT_LEAKAGE_RATIO } from '../snubber'
import { computeOperatingPoint } from './flyback/operating-point'
import { computeCoreAndTurns } from './flyback/core'
import { computeSecondaryResults } from './flyback/secondaries'
import { computeFlybackLosses } from './flyback/losses'
import { computeFlybackWarnings } from './flyback/warnings'
import { createFlybackTransferFunction } from './flyback/tf'

export const flybackTopology: Topology = {
  id: 'flyback',
  name: 'Flyback',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vinMax, vout, iout, fsw, voutRippleMax } = spec
    const secondaries = spec.secondary_outputs ?? []
    const vinNom      = (vinMin + vinMax) / 2

    const op = computeOperatingPoint(spec, secondaries)
    const { dMax, magnetizingInductance, primaryCurrentAvg, deltaIm, primaryPeakCurrent, turnsRatio } = op

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
      iout, dMax, snubber, pPrimary, ccm_dcm_boundary, secondaries,
    )

    const secondaryOutputResults = secondaries.length > 0
      ? computeSecondaryResults(secondaries, primaryTurns, dMax, vinNom, vinMax, fsw)
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
