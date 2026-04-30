import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import { DesignSpec, DesignResult, Topology, TransferFunction } from '../types'

function normalizeDuty(duty: number): number {
  return Math.min(Math.max(duty, 0.01), 0.99)
}

function createTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const D = result.dutyCycle
  const L = result.inductor.value
  const C = result.output_cap.value
  const voutMag = Math.abs(spec.vout)
  const Rload = voutMag / spec.iout
  const k = voutMag / (1 - D)
  const frhpz = ((1 - D) ** 2 * Rload) / (2 * Math.PI * L)
  const omegaRHPZ = 2 * Math.PI * frhpz
  const omega0 = (1 - D) / Math.sqrt(L * C)

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
   * Schematic:
   * Vin ----[ Switch ]----(SW Node)----[ Inductor ]---- Vout (Negative Polarity)
   *                          |
   *                       [ Diode ] (Cathode to SW, Anode to GND)
   *                          |
   *                         GND
   */

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vinMax, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency } = spec
    const voutMag = Math.abs(vout)

    const targetEfficiency = Math.min(Math.max(efficiency, 0.5), 1)
    const rawDuty = voutMag / (vinMin * targetEfficiency + voutMag)
    const dutyCycle = normalizeDuty(rawDuty)

    const inductorCurrent = iout / (1 - dutyCycle)
    const rippleFactor = Math.max(rippleRatio ?? 0.4, 0.1) // Default to 40% ripple if not provided
    const deltaIL = rippleFactor * inductorCurrent // Use inductor current for ripple calculation
    const inductance = (vinMin * dutyCycle) / (fsw * deltaIL)
    const peakCurrent = inductorCurrent + deltaIL / 2

    const deltaVout = Math.max(voutRippleMax, 0.01 * voutMag)
    const capacitance = (iout * dutyCycle) / (fsw * deltaVout)

    const mosfetVdsMax = vinMax + voutMag
    const diodeVrMax = vinMax + voutMag

    // Loss Breakdown Calculations
    const IL_rms = Math.sqrt(inductorCurrent * inductorCurrent + (deltaIL * deltaIL) / 12)
    const I_sw_rms = IL_rms * Math.sqrt(dutyCycle)
    const I_cout_rms = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))

    const mosfet_conduction = I_sw_rms * I_sw_rms * 0.02 // 20mΩ rdsOn
    const mosfet_switching = 0.5 * mosfetVdsMax * peakCurrent * (50e-9) * fsw // 25ns trise + 25ns tfall
    const mosfet_gate = 12e-9 * vinMin * fsw // 12nC Qg
    const inductor_copper = IL_rms * IL_rms * 0.045 // 45mΩ DCR
    const inductor_core = 0.02 * inductorCurrent * deltaIL
    const diode_conduction = 0.7 * iout // 0.7V Vf
    const capacitor_esr = I_cout_rms * I_cout_rms * 0.02 // 20mΩ ESR

    const totalLoss = mosfet_conduction + mosfet_switching + mosfet_gate + inductor_copper + inductor_core + diode_conduction + capacitor_esr
    const pout = voutMag * iout
    // Safe divide to prevent NaN if output power is 0
    const calcEfficiency = pout <= 0 ? 0 : pout / (pout + totalLoss)

    const warnings: string[] = []
    if (dutyCycle >= 0.9) {
      warnings.push('Buck-boost duty cycle exceeds 90% and may reduce control margin and efficiency.')
    }
    if (dutyCycle <= 0.1) {
      warnings.push('Buck-boost duty cycle is below 10% and the converter may be sensitive to noise.')
    }
    if (peakCurrent > 3 * iout) {
      warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')
    }

    if (iout > 0) {
      const rload = voutMag / iout
      const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
      const crossoverEstimate = fsw / 10
      if (frhpz > 0 && crossoverEstimate > frhpz / 3) {
        warnings.push(`Right-half-plane zero at ${Math.round(frhpz)} Hz may limit the crossover frequency.`)
      }
    }

    warnings.push(`High component stress: Switch and diode see Vin + |Vout| (${Math.round(mosfetVdsMax)}V max).`)

    return {
      dutyCycle,
      inductance,
      capacitance,
      peakCurrent,
      inductor: {
        value: inductance,
        peak_current: peakCurrent,
        rms_current: IL_rms,
      },
      output_cap: {
        value: capacitance,
        esr_max: 0.05, // Placeholder, depends on ripple spec
        ripple_current: I_cout_rms,
      },
      efficiency: calcEfficiency,
      losses: {
        primaryCopper: inductor_copper,
        secondaryCopper: 0,
        core: inductor_core,
        mosfet: mosfet_conduction + mosfet_switching + mosfet_gate,
        diode: diode_conduction,
        clamp: capacitor_esr,
        total: totalLoss
      },
      mosfetVdsMax,
      diodeVrMax,
      warnings,
    }
  },

  getTransferFunction(spec: DesignSpec, result: DesignResult) {
    return createTransferFunction(spec, result)
  }
}
