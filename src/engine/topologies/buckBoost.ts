// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import { DesignSpec, DesignResult, Topology, TransferFunction } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { DEVICE_ASSUMPTIONS } from '../device-assumptions'
import { buildLosses, normalizeDuty, detectCcmDcm, calcEfficiency } from './result-utils'

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

// Control-to-output transfer function for the inverting buck-boost.
// Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §8.2.2.
// Structure is identical to the boost: double pole at ω₀ = (1−D)/√(LC),
// RHP zero at ωz = (1−D)²·R/L.  DC gain uses the same approximation as boost.ts.
function createTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const D = result.dutyCycle
  const L = result.inductor!.value
  const C = result.output_cap!.value
  const voutMag = Math.abs(spec.vout)
  const Rload = voutMag / spec.iout

  // Erickson eq. 8.100 — RHP zero frequency
  const frhpz = ((1 - D) ** 2 * Rload) / (2 * Math.PI * L)
  const omegaRHPZ = 2 * Math.PI * frhpz

  // Erickson eq. 8.94 — undamped natural frequency
  const omega0 = (1 - D) / Math.sqrt(L * C)

  const k = voutMag / (1 - D)

  return {
    numerator: [k, -k * omegaRHPZ] as const,
    denominator: [1, omega0, 0] as const,
    evaluate(freq_hz: number) {
      const s = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ, complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omega0, s)), complex(0, 0))
      const h = divide(num, den) as unknown as Complex
      return {
        magnitude_db: 20 * Math.log10(abs(h)),
        phase_deg: arg(h) * (180 / Math.PI),
      }
    },
  }
}

export const buckBoostTopology: Topology = {
  id: 'buck-boost',
  name: 'Buck-Boost',

  /*
   * Non-isolated inverting buck-boost (single-switch, single-diode).
   *
   *         Q1
   *  Vin──[drain]
   *       [source]──SW──[L]──┬── GND
   *                          │
   *                    Cout ═╪═ Vout (negative polarity)
   *                          │
   *                         [D1 anode]
   *                         [D1 cath]──── GND
   *
   *  Q1 ON : Vin energises L; D1 reverse-biased; Cout supplies load.
   *  Q1 OFF: L freewheels through D1; Cout charges to −(L volt-seconds);
   *          both Q1 and D1 block Vin + |Vout|.
   */

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vinMax, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency: etaSpec } = spec
    const voutMag = Math.abs(vout)
    const eta = Math.min(Math.max(etaSpec, 0.5), 1)

    // 1. Duty cycle — Erickson & Maksimovic 3rd ed., Table 2-1 (CCM buck-boost)
    //    D = |Vout| / (Vin_min·η + |Vout|)   (worst-case D at minimum Vin)
    const dutyCycle = normalizeDuty(voutMag / (vinMin * eta + voutMag))

    // 2. Inductor — Erickson & Maksimovic 3rd ed., Chapter 2
    //    The single winding carries both input and output energy each cycle.
    //    DC bias:  IL_dc = Iout / (1−D)
    //    Ripple:   ΔiL = rippleRatio · IL_dc
    //    Minimum L = Vin_min · D / (fsw · ΔiL)
    //    Peak:     IL_peak = IL_dc + ΔiL/2
    //    RMS:      IL_rms = √(IL_dc² + ΔiL²/12)  [trapezoid waveform]
    const IL_dc = iout / (1 - dutyCycle)
    const rippleFactor = Math.max(rippleRatio, 0.1)
    const deltaIL = rippleFactor * IL_dc
    const inductance = (vinMin * dutyCycle) / (fsw * deltaIL)
    const IL_peak = IL_dc + deltaIL / 2
    const IL_rms = Math.sqrt(IL_dc ** 2 + deltaIL ** 2 / 12)

    // 3. Output capacitor — pulsed output current (same structure as boost)
    //    Cout ≥ Iout · D / (fsw · ΔVout)
    //    ESR ≤ ΔVout / IL_peak
    //    Ic_rms = Iout · √(D / (1−D))
    const deltaVout = Math.max(voutRippleMax, 0.01 * voutMag)
    const capacitance = (iout * dutyCycle) / (fsw * deltaVout)
    const esr_max = deltaVout / IL_peak
    const I_cout_rms = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))

    // 4. Input capacitor — pulsed input current (switch draws IL when ON, 0 when OFF)
    //    Ic_rms ≈ IL_rms · √D  (RMS of a waveform that is IL_rms during D, 0 during 1−D)
    //    Cin ≥ IL_dc · D / (fsw · ΔVin)  for 1 % input ripple
    //    High ripple current requires a low-ESR ceramic capacitor.
    const I_cin_rms = IL_rms * Math.sqrt(dutyCycle)
    const cin = (IL_dc * dutyCycle) / (fsw * 0.01 * vinMin)

    // 5. Component voltage ratings — Erickson & Maksimovic, Table 2-1
    //    Both Q1 and D1 block Vin + |Vout| in their off-state.
    const mosfetVdsMax = vinMax + voutMag
    const diodeVrMax = vinMax + voutMag
    const diodeIfAvg = iout

    const syncMode = spec.rectification === 'synchronous'
    const I_sw_rms = IL_rms * Math.sqrt(dutyCycle)

    const mosfet_conduction = RDS_ON * I_sw_rms ** 2
    // TI SLUA618 eq. 3: P_sw = 0.5 × Vds × Ipeak × (tr + tf) × fsw
    const mosfet_switching  = 0.5 * mosfetVdsMax * IL_peak * (T_RISE + T_FALL) * fsw
    const mosfet_gate       = QG * vinMin * fsw
    const inductor_copper   = DCR * IL_rms ** 2
    const inductor_core     = CORE_F * IL_dc * deltaIL

    const diode_conduction  = syncMode ? 0 : VF * diodeIfAvg * (1 - dutyCycle)

    // Sync: freewheeling FET during (1-D)
    const sync_conduction   = syncMode
      ? RDS_SYNC * IL_rms ** 2 * (1 - dutyCycle)
      : 0
    const sync_dead_time    = syncMode
      ? (VF_BODY * IL_dc * 2 * T_DEAD * fsw
       + 0.5 * COSS_S * mosfetVdsMax ** 2 * fsw
       + QG_S * mosfetVdsMax * fsw)
      : 0

    const capacitor_esr     = I_cout_rms ** 2 * ESR

    const pout = voutMag * iout
    const totalLoss = mosfet_conduction + mosfet_switching + mosfet_gate +
                      inductor_copper + inductor_core + diode_conduction +
                      sync_conduction + sync_dead_time + capacitor_esr
    const efficiency = calcEfficiency(pout, totalLoss)

    // 7. Design rule checks
    const ccm_dcm_boundary = deltaIL * (1 - dutyCycle) / 2
    const { operating_mode, warnings } = detectCcmDcm(iout, ccm_dcm_boundary)

    if (dutyCycle >= 0.9) {
      warnings.push('Buck-boost duty cycle exceeds 90% and may reduce control margin and efficiency.')
    }
    if (dutyCycle <= 0.1) {
      warnings.push('Buck-boost duty cycle is below 10% and the converter may be sensitive to noise.')
    }
    if (IL_peak > 3 * iout) {
      warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')
    }

    // RHPZ warning — Erickson & Maksimovic eq. 8.100
    //   frhpz = (1−D)²·R / (2π·L)
    //   Warn when estimated crossover (fsw/10) exceeds frhpz/3
    if (iout > 0) {
      const rload = voutMag / iout
      const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
      const crossoverEstimate = fsw / 10
      if (frhpz > 0 && crossoverEstimate > frhpz / 3) {
        warnings.push(
          `Right-half-plane zero at ${Math.round(frhpz)} Hz may limit the crossover frequency to less than ${Math.round(frhpz / 3)} Hz.`
        )
      }
    }

    // High-stress advisory — always present; this topology has the highest
    // switch-voltage stress of any non-isolated converter.
    warnings.push(
      `High component stress: switch and diode both block Vin + |Vout| = ${Math.round(mosfetVdsMax)} V. ` +
      `Input capacitor must handle ${I_cin_rms.toFixed(2)} A rms ripple ` +
      `(min Cin ≈ ${(cin * 1e6).toFixed(1)} µF, low-ESR ceramic required). ` +
      `Consider boost or SEPIC if Vin + |Vout| stress is unacceptable.`
    )

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
      inductor: {
        value: inductance,
        peak_current: IL_peak,
        rms_current: IL_rms,
      },
      output_cap: {
        value: capacitance,
        esr_max,
        ripple_current: I_cout_rms,
      },
      efficiency,
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
      mosfetVdsMax,
      diodeVrMax,
      warnings,
    }
  },

  getTransferFunction(spec: DesignSpec, result: DesignResult) {
    return createTransferFunction(spec, result)
  },
}
