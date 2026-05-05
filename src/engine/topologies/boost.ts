import { complex, abs, arg, add, multiply, divide } from 'mathjs'
import { DesignSpec, DesignResult, Topology } from '../types'
import { checkSaturation } from '../inductor-saturation'

function normalizeDuty(duty: number): number {
  return Math.min(Math.max(duty, 0.01), 0.99)
}

function createTransferFunction(spec: DesignSpec, result: DesignResult) {
  const D = result.dutyCycle
  const L = result.inductance
  const C = result.capacitance
  const Rload = spec.vout / spec.iout
  const k = spec.vout / (1 - D)
  const frhpz = ((1 - D) ** 2 * Rload) / (2 * Math.PI * L)
  const omegaRHPZ = 2 * Math.PI * frhpz
  const omega0 = 1 / Math.sqrt(L * C)

  return {
    numerator: [k, -k * omegaRHPZ],
    denominator: [1, omega0, 0],
    evaluate(freq_hz: number) {
      const s = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ, complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omega0, s)), complex(0, 0))
      const h = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h)),
        phase_deg: arg(h) * (180 / Math.PI),
      }
    },
  }
}

export const boostTopology: Topology = {
  id: 'boost',
  name: 'Boost (Step-Up)',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency } = spec

    // 1. Duty cycle: D = 1 - (Vin × η) / Vout
    const rawDuty = 1 - (vinMin * Math.min(Math.max(efficiency, 0.5), 1)) / vout
    const dutyCycle = normalizeDuty(rawDuty)

    // 2. Inductor: L = Vin × D / (fsw × ΔIL)
    // Input current is continuous: Iin = Iout / (1 − D)
    const inputCurrent = iout / (1 - dutyCycle)
    const rippleFactor = Math.max(rippleRatio, 0.1)
    const deltaIL = rippleFactor * inputCurrent
    const inductance = (vinMin * dutyCycle) / (fsw * deltaIL)
    const peakCurrent = inputCurrent + deltaIL / 2

    // 3. Output capacitor: pulsed current requires higher cap and ESR control
    const deltaVout = Math.max(voutRippleMax, 0.01 * vout)
    const capacitance = (iout * dutyCycle) / (fsw * deltaVout)

    // CCM/DCM boundary detection
    // For boost: Iout_crit = ΔIL × (1-D) / 2
    const ccm_dcm_boundary = deltaIL * (1 - dutyCycle) / 2
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
    
    if (dutyCycle >= 0.9) {
      warnings.push('Boost duty cycle exceeds 90% and may reduce efficiency and control margin.')
    }
    if (dutyCycle <= 0.1) {
      warnings.push('Boost duty cycle is below 10% and the converter may be sensitive to noise.')
    }
    if (peakCurrent > 3 * iout) {
      warnings.push('Inductor peak current exceeds 3× output current and may stress the switch and inductor.')
    }

    const rload = vout / iout
    const frhpz = ((1 - dutyCycle) ** 2 * rload) / (2 * Math.PI * inductance)
    const crossoverEstimate = fsw / 10
    if (frhpz > 0 && crossoverEstimate > frhpz / 3) {
      warnings.push(`Right-half-plane zero at ${Math.round(frhpz)} Hz may limit crossover to less than one-third of the RHPZ frequency.`)
    }

    const saturation_check = checkSaturation(peakCurrent, inputCurrent)
    if (saturation_check.warning) warnings.push(saturation_check.warning)

    return {
      dutyCycle,
      inductance,
      capacitance,
      peakCurrent,
      ccm_dcm_boundary,
      operating_mode,
      saturation_check,
      warnings,
    }
  },

  getTransferFunction(spec, result) {
    return createTransferFunction(spec, result)
  },
}
