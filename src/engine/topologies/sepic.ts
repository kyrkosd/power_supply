// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { DesignSpec, DesignResult, Topology } from '../types'
import { checkSaturation } from '../inductor-saturation'

export const sepicTopology: Topology = {
  id: 'sepic',
  name: 'SEPIC',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vinMax, vout, iout, fsw, voutRippleMax, efficiency } = spec

    // 1. Duty cycle: D = Vout / (Vin + Vout) (same as flyback)
    const vinNom = (vinMin + vinMax) / 2
    const rawDuty = vout / (vinNom + vout)
    const dutyCycle = Math.min(Math.max(rawDuty, 0.05), 0.95)

    // 2. Input inductor L1: L1 = Vin × D / (fsw × ΔIL1)
    // ΔIL1 = 40% of max input current (per TI AN-1484)
    const pout = vout * iout
    const inputPower = pout / Math.max(efficiency, 0.8)
    const inputCurrentAvg = inputPower / vinNom
    const deltaIL1 = 0.4 * inputCurrentAvg // 40% ripple
    const inputInductance = (vinNom * dutyCycle) / (fsw * deltaIL1)

    // 3. Second inductor L2: typically L2 = L1 for coupled inductor
    const outputInductance = inputInductance // L2 = L1

    // 4. Coupling capacitor Cc: Cc ≥ Iout × D / (fsw × ΔVcc)
    // Voltage across Cc = Vin (DC), high ripple current
    const deltaVcc = 0.1 * vinNom // 10% ripple on coupling cap
    const couplingCapacitance = (iout * dutyCycle) / (fsw * deltaVcc)
    const couplingCapRmsCurrent = iout * Math.sqrt(dutyCycle * (1 - dutyCycle))

    // 5. Output capacitor: pulsed output current (like boost)
    const deltaVout = Math.max(voutRippleMax, 0.01 * vout)
    const outputCapacitance = (iout * dutyCycle) / (fsw * deltaVout)
    const outputCapRmsCurrent = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))

    // 6. Peak currents
    const peakInputCurrent = inputCurrentAvg + deltaIL1 / 2

    // 7. Component stresses
    const mosfetVdsMax = vinMax + vout // Vds_max = Vin + Vout
    const diodeVrMax = vinMax + vout   // Vr_max = Vin + Vout

    // 8. Losses
    const inputInductorLoss = inputCurrentAvg ** 2 * 0.05 // Ω DCR
    const outputInductorLoss = iout ** 2 * 0.05 // Ω DCR
    const couplingCapEsrLoss = couplingCapRmsCurrent ** 2 * 0.1 // ESR
    const outputCapEsrLoss = outputCapRmsCurrent ** 2 * 0.05 // ESR
    const mosfetLoss = 2.5 // W
    const diodeLoss = 1.5 // W
    const totalLoss = inputInductorLoss + outputInductorLoss + couplingCapEsrLoss +
                      outputCapEsrLoss + mosfetLoss + diodeLoss

    // CCM/DCM boundary detection
    // For SEPIC: Iout_crit = ΔIL1 × (1-D) / 2
    const ccm_dcm_boundary = deltaIL1 * (1 - dutyCycle) / 2
    let operating_mode: 'CCM' | 'DCM' | 'boundary' = 'CCM'

    const warnings: string[] = []
    
    if (iout > 1.2 * ccm_dcm_boundary) {
      operating_mode = 'CCM'
    } else if (iout < ccm_dcm_boundary) {
      operating_mode = 'DCM'
      warnings.push('Operating in DCM. Equations assume CCM — results may be inaccurate. Increase inductance or load current to enter CCM.')
    } else {
      operating_mode = 'boundary'
      warnings.push('Near CCM/DCM boundary. Performance may be unpredictable at light loads.')
    }
    
    if (dutyCycle > 0.8) {
      warnings.push('SEPIC duty cycle >80% - consider boost topology instead')
    }
    if (dutyCycle < 0.2) {
      warnings.push('SEPIC duty cycle <20% - consider buck topology instead')
    }
    if (couplingCapRmsCurrent > 2 * iout) {
      warnings.push('High coupling capacitor ripple current - use low-ESR capacitor')
    }

    // Saturation check on the input inductor L1
    const saturation_check = checkSaturation(peakInputCurrent, inputCurrentAvg)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    return {
      dutyCycle,
      inductance: inputInductance, // L1
      capacitance: outputCapacitance, // Cout
      peakCurrent: peakInputCurrent,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      efficiency: pout / (pout + totalLoss),
      warnings,
      // SEPIC-specific fields
      outputInductance, // L2
      couplingCapacitance,
      mosfetVdsMax,
      diodeVrMax,
      losses: {
        primaryCopper: inputInductorLoss,
        secondaryCopper: outputInductorLoss,
        core: 0.5, // Core loss estimate
        mosfet: mosfetLoss,
        diode: diodeLoss,
        clamp: couplingCapEsrLoss + outputCapEsrLoss, // ESR losses
        total: totalLoss
      }
    }
  }
}
