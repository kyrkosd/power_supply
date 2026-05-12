import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import { DesignSpec, DesignResult, Topology, TransferFunction } from '../types'
import { checkSaturation } from '../inductor-saturation'
import { RDS_ON, T_RISE, T_FALL, QG, VF, DCR, ESR, CORE_F, RDS_SYNC, T_DEAD, COSS_S, QG_S, VF_BODY } from '../device-assumptions'
import { buildLosses, normalizeDuty, detectCcmDcm, calcEfficiency } from './result-utils'

// ── Transfer function ─────────────────────────────────────────────────────────

// Control-to-output transfer function for the inverting buck-boost.
// Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §8.2.2.
// Structure is identical to boost: double pole at ω₀ = (1−D)/√(LC),
// RHP zero at ωz = (1−D)²·R/L.
function createTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const D      = result.dutyCycle
  const L      = result.inductor!.value
  const C      = result.output_cap!.value
  const voutMag = Math.abs(spec.vout)
  const Rload  = voutMag / spec.iout

  const frhpz     = ((1 - D) ** 2 * Rload) / (2 * Math.PI * L) // Erickson eq. 8.100
  const omegaRHPZ = 2 * Math.PI * frhpz
  const omega0    = (1 - D) / Math.sqrt(L * C)                  // Erickson eq. 8.94
  const k         = voutMag / (1 - D)

  return {
    numerator:   [k, -k * omegaRHPZ] as const,
    denominator: [1, omega0, 0] as const,
    evaluate(freq_hz: number) {
      const s   = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ, complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omega0, s)), complex(0, 0))
      const h   = divide(num, den) as unknown as Complex
      return {
        magnitude_db: 20 * Math.log10(abs(h)),
        phase_deg:    arg(h) * (180 / Math.PI),
      }
    },
  }
}

// ── Section helpers ───────────────────────────────────────────────────────────

interface BuckBoostOperatingPoint {
  dutyCycle:    number  // —
  IL_dc:        number  // A — DC bias of the single winding
  deltaIL:      number  // A — ripple
  inductance:   number  // H
  IL_peak:      number  // A
  IL_rms:       number  // A
  mosfetVdsMax: number  // V — Q1 and D1 both block Vin + |Vout|
  diodeVrMax:   number  // V
  capacitance:  number  // F
  esr_max:      number  // Ω
  I_cout_rms:   number  // A
  I_cin_rms:    number  // A
  cin:          number  // F — minimum input capacitance
}

/**
 * Duty cycle, inductor, and capacitor sizing for CCM inverting buck-boost.
 * D = |Vout| / (Vin·η + |Vout|) at worst-case Vin_min.
 * Erickson & Maksimovic 3rd ed., Table 2-1.
 * Both Q1 and D1 block Vin + |Vout| in their off-state.
 */
function computeOperatingPoint(spec: DesignSpec): BuckBoostOperatingPoint {
  const { vinMin, vinMax, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency: etaSpec } = spec
  const voutMag = Math.abs(vout)
  const eta     = Math.min(Math.max(etaSpec, 0.5), 1)

  const dutyCycle = normalizeDuty(voutMag / (vinMin * eta + voutMag))

  // Inductor: DC bias = Iout/(1-D); L_min = Vin·D / (fsw·ΔiL)
  const IL_dc      = iout / (1 - dutyCycle)
  const rippleFactor = Math.max(rippleRatio, 0.1)
  const deltaIL    = rippleFactor * IL_dc
  const inductance = (vinMin * dutyCycle) / (fsw * deltaIL)
  const IL_peak    = IL_dc + deltaIL / 2
  const IL_rms     = Math.sqrt(IL_dc ** 2 + deltaIL ** 2 / 12)

  // Output cap: pulsed current — same structure as boost
  const deltaVout   = Math.max(voutRippleMax, 0.01 * voutMag)
  const capacitance = (iout * dutyCycle) / (fsw * deltaVout)
  const esr_max     = deltaVout / IL_peak
  const I_cout_rms  = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))

  // Input cap: switch draws IL during D, 0 during (1-D)
  const I_cin_rms = IL_rms * Math.sqrt(dutyCycle)
  const cin       = (IL_dc * dutyCycle) / (fsw * 0.01 * vinMin)

  // Both devices block Vin + |Vout| — Erickson Table 2-1
  const mosfetVdsMax = vinMax + voutMag
  const diodeVrMax   = vinMax + voutMag

  return { dutyCycle, IL_dc, deltaIL, inductance, IL_peak, IL_rms,
           mosfetVdsMax, diodeVrMax, capacitance, esr_max, I_cout_rms, I_cin_rms, cin }
}

/**
 * Loss breakdown for a CCM buck-boost.
 * TI SLUA618 eq. 3 for switching losses.
 * Sync FET replaces freewheeling diode during (1-D) in synchronous mode.
 */
function computeLosses(
  spec: DesignSpec,
  dutyCycle: number,
  IL_peak: number,
  IL_rms: number,
  deltaIL: number,
  mosfetVdsMax: number,
  I_cout_rms: number,
  IL_dc: number,
) {
  const { vinMin, iout, fsw } = spec
  const syncMode = spec.rectification === 'synchronous'
  const I_sw_rms = IL_rms * Math.sqrt(dutyCycle)

  const mosfet_conduction = RDS_ON * I_sw_rms ** 2
  // TI SLUA618 eq. 3: P_sw = 0.5 × Vds × Ipeak × (tr + tf) × fsw
  const mosfet_switching  = 0.5 * mosfetVdsMax * IL_peak * (T_RISE + T_FALL) * fsw
  const mosfet_gate       = QG * vinMin * fsw

  const inductor_copper = DCR * IL_rms ** 2
  const inductor_core   = CORE_F * IL_dc * deltaIL

  const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)
  const sync_conduction  = syncMode ? RDS_SYNC * IL_rms ** 2 * (1 - dutyCycle) : 0
  const sync_dead_time   = syncMode
    ? VF_BODY * IL_dc * 2 * T_DEAD * fsw
      + 0.5 * COSS_S * mosfetVdsMax ** 2 * fsw
      + QG_S * mosfetVdsMax * fsw
    : 0
  const capacitor_esr = I_cout_rms ** 2 * ESR

  return {
    mosfet_conduction, mosfet_switching, mosfet_gate,
    inductor_copper,   inductor_core,
    diode_conduction,  sync_conduction,  sync_dead_time,
    capacitor_esr,
  }
}

/**
 * Design rule warnings for an inverting buck-boost.
 * Includes duty-cycle extremes, RHPZ check, and the mandatory
 * high-stress voltage/current advisory.
 * RHPZ: Erickson & Maksimovic eq. 8.100.
 */
function computeWarnings(
  spec: DesignSpec,
  dutyCycle: number,
  inductance: number,
  IL_peak: number,
  IL_dc: number,
  mosfetVdsMax: number,
  I_cin_rms: number,
  cin: number,
): string[] {
  const { fsw, iout } = spec
  const voutMag = Math.abs(spec.vout)
  const warnings: string[] = []

  if (dutyCycle >= 0.9)
    warnings.push('Buck-boost duty cycle exceeds 90% and may reduce control margin and efficiency.')
  if (dutyCycle <= 0.1)
    warnings.push('Buck-boost duty cycle is below 10% and the converter may be sensitive to noise.')
  if (IL_peak > 3 * iout)
    warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')

  if (iout > 0) {
    const rload = voutMag / iout
    const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
    if (frhpz > 0 && fsw / 10 > frhpz / 3)
      warnings.push(`Right-half-plane zero at ${Math.round(frhpz)} Hz may limit the crossover frequency to less than ${Math.round(frhpz / 3)} Hz.`)
  }

  // High-stress is always present; both devices block Vin + |Vout|.
  warnings.push(
    `High component stress: switch and diode both block Vin + |Vout| = ${Math.round(mosfetVdsMax)} V. ` +
    `Input capacitor must handle ${I_cin_rms.toFixed(2)} A rms ripple ` +
    `(min Cin ≈ ${(cin * 1e6).toFixed(1)} µF, low-ESR ceramic required). ` +
    `Consider boost or SEPIC if Vin + |Vout| stress is unacceptable.`
  )

  return warnings
}

// ── Topology export ───────────────────────────────────────────────────────────

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
 *  Q1 OFF: L freewheels through D1; Cout charges to −(L volt-seconds).
 */
export const buckBoostTopology: Topology = {
  id: 'buck-boost',
  name: 'Buck-Boost',

  compute(spec: DesignSpec): DesignResult {
    const op = computeOperatingPoint(spec)
    const { dutyCycle, IL_dc, deltaIL, inductance, IL_peak, IL_rms,
            mosfetVdsMax, diodeVrMax, capacitance, esr_max, I_cout_rms, I_cin_rms, cin } = op

    const lossComps = computeLosses(spec, dutyCycle, IL_peak, IL_rms, deltaIL, mosfetVdsMax, I_cout_rms, IL_dc)
    const totalLoss =
      lossComps.mosfet_conduction + lossComps.mosfet_switching + lossComps.mosfet_gate +
      lossComps.inductor_copper   + lossComps.inductor_core    + lossComps.diode_conduction +
      lossComps.sync_conduction   + lossComps.sync_dead_time   + lossComps.capacitor_esr
    const efficiency = calcEfficiency(Math.abs(spec.vout) * spec.iout, totalLoss)

    const ccm_dcm_boundary = deltaIL * (1 - dutyCycle) / 2
    const { operating_mode, warnings: ccmWarn } = detectCcmDcm(spec.iout, ccm_dcm_boundary)
    const warnings = [
      ...ccmWarn,
      ...computeWarnings(spec, dutyCycle, inductance, IL_peak, IL_dc, mosfetVdsMax, I_cin_rms, cin),
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
    return createTransferFunction(spec, result)
  },
}
