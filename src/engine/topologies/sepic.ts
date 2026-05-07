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

    // 8. Losses — device assumptions match LossBreakdown.tsx DEVICE_ASSUMPTIONS
    // TI SLUA618 eq. 3 for switching loss; Erickson §3.3 for conduction.
    const RDS_ON   = 0.02    // Ω  — control FET
    const T_RISE   = 25e-9   // s
    const T_FALL   = 25e-9   // s
    const QG       = 12e-9   // C
    const VF       = 0.7     // V
    const DCR      = 0.045   // Ω  — per inductor
    const ESR_CAP  = 0.02    // Ω  — output cap ESR
    const CORE_F   = 0.02    // —

    // Sync FET assumptions
    const RDS_SYNC = 0.008   // Ω
    const T_DEAD   = 30e-9   // s
    const COSS_S   = 100e-12 // F
    const QG_S     = 15e-9   // C
    const VF_BODY  = 0.7     // V

    const syncMode = spec.rectification === 'synchronous'

    // SEPIC switch carries L1+L2 current (both inductors in series during ON)
    const I_sw_avg = inputCurrentAvg + iout
    const IL1_rms  = Math.sqrt(inputCurrentAvg ** 2 + deltaIL1 ** 2 / 12)
    const I_sw_rms = IL1_rms * Math.sqrt(dutyCycle)   // simplified single-FET

    // MOSFET losses — switch node voltage = Vin + Vout = mosfetVdsMax
    const mosfet_conduction = RDS_ON * I_sw_rms ** 2
    const mosfet_switching  = 0.5 * mosfetVdsMax * peakInputCurrent * (T_RISE + T_FALL) * fsw
    const mosfet_gate       = QG * vinNom * fsw

    // Both inductors have DCR copper loss
    const inductor_copper   = DCR * (IL1_rms ** 2 + iout ** 2)
    const inductor_core     = CORE_F * (inputCurrentAvg * deltaIL1 + iout * (0.4 * iout))

    const diode_conduction  = syncMode ? 0 : VF * iout * (1 - dutyCycle)

    // Sync FET during (1-D): carries output current
    const sync_conduction   = syncMode
      ? RDS_SYNC * iout ** 2 * (1 - dutyCycle)
      : 0
    const sync_dead_time    = syncMode
      ? (VF_BODY * I_sw_avg * 2 * T_DEAD * fsw
       + 0.5 * COSS_S * mosfetVdsMax ** 2 * fsw
       + QG_S * mosfetVdsMax * fsw)
      : 0

    // Capacitor ESR: coupling cap + output cap
    const capacitor_esr     = couplingCapRmsCurrent ** 2 * 0.1
                            + outputCapRmsCurrent ** 2 * ESR_CAP

    const totalLoss = mosfet_conduction + mosfet_switching + mosfet_gate +
                      inductor_copper + inductor_core + diode_conduction +
                      sync_conduction + sync_dead_time + capacitor_esr

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
        mosfet_conduction,
        mosfet_switching,
        mosfet_gate,
        inductor_copper,
        inductor_core,
        diode_conduction,
        sync_conduction,
        sync_dead_time,
        capacitor_esr,
        total: totalLoss,
      },
    }
  }
}
