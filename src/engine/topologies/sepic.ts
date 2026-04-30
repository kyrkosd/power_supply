import { DesignSpec, DesignResult, Topology } from '../types'

export const sepicTopology: Topology = {
  id: 'sepic',
  name: 'SEPIC',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vinMax, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency } = spec

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
    const peakOutputCurrent = iout // SEPIC has continuous output current

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

    const warnings: string[] = []
    if (dutyCycle > 0.8) {
      warnings.push('SEPIC duty cycle >80% - consider boost topology instead')
    }
    if (dutyCycle < 0.2) {
      warnings.push('SEPIC duty cycle <20% - consider buck topology instead')
    }
    if (couplingCapRmsCurrent > 2 * iout) {
      warnings.push('High coupling capacitor ripple current - use low-ESR capacitor')
    }

    return {
      dutyCycle,
      inductance: inputInductance, // L1
      capacitance: outputCapacitance, // Cout
      peakCurrent: peakInputCurrent,
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
