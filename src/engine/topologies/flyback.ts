import { complex, abs, arg, add, multiply, divide } from 'mathjs'
import { DesignSpec, DesignResult, Topology, TransferFunction } from '../types'
import coresData from '../../data/cores.json'

interface CoreData {
  type: string
  Ae: number  // m²
  Aw: number  // m²
  le: number  // m
  Ve: number  // m³
  AL: number  // nH/N²
}

const cores: CoreData[] = coresData as CoreData[]

function selectCore(areaProduct: number): CoreData | null {
  // Find the smallest core that meets the area product requirement
  const suitable = cores.filter(core => core.Ae * core.Aw >= areaProduct)
  if (suitable.length === 0) return null
  return suitable.reduce((min, core) => 
    (core.Ae * core.Aw < min.Ae * min.Aw) ? core : min
  )
}

function createFlybackTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const D = result.dutyCycle
  const Lm = result.magnetizingInductance || result.inductance
  const C = result.capacitance
  const Rload = spec.vout / spec.iout
  const N = result.turnsRatio || 1

  // Flyback transfer function: single pole + RHPZ
  // H(s) = (N * (1-D) * (1 + s/(Q*ω0))) / (1 + s/(Q*ω0) + s²/ω0²)
  // Simplified: H(s) = k * (1 - s/ω_rhpz) / (1 + s/ω_p)
  const k = N * (1 - D)
  const omegaRHPZ = (1 - D)**2 * Rload / (2 * Math.PI * Lm)
  const omegaP = 1 / Math.sqrt(Lm * C)

  return {
    numerator: [k, -k * omegaRHPZ / (2 * Math.PI)],
    denominator: [1, omegaP / (2 * Math.PI), 0],
    evaluate(freq_hz: number) {
      const s = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ / (2 * Math.PI), complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omegaP / (2 * Math.PI), s)), complex(0, 0))
      const h = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h)),
        phase_deg: arg(h) * (180 / Math.PI),
      }
    },
  }
}

export const flybackTopology: Topology = {
  id: 'flyback',
  name: 'Flyback',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vinMax, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency } = spec

    // For offline flyback, use vin_nom for calculations
    const vinNom = (vinMin + vinMax) / 2
    const dMax = Math.min(0.45, vout / (vinNom + vout)) // Limit duty cycle

    // 1. Turns ratio N = Np/Ns = (Vin_nom × D_max) / Vout
    const turnsRatio = (vinNom * dMax) / vout

    // 2. Magnetizing inductance (CCM boundary): Lm = (Vin_min × D_max)² / (2 × Pout × fsw)
    const pout = vout * iout
    const magnetizingInductance = (vinMin * dMax) ** 2 / (2 * pout * fsw)

    // 3. Primary peak current: Ip_peak = (Pout / (η × Vin_min × D_max)) + ΔIm/2
    const inputPower = pout / Math.max(efficiency, 0.7)
    const primaryCurrentAvg = inputPower / vinMin
    const deltaIm = rippleRatio * primaryCurrentAvg
    const primaryPeakCurrent = primaryCurrentAvg + deltaIm / 2

    // 4. Core selection using area product method
    const bMax = 0.3 // T, typical for ferrite
    const j = 400000 // A/m², current density
    const ku = 0.4 // window utilization
    const areaProduct = (magnetizingInductance * primaryPeakCurrent * primaryCurrentAvg) / (bMax * j * ku)

    const selectedCore = selectCore(areaProduct)
    if (!selectedCore) {
      return {
        dutyCycle: dMax,
        inductance: magnetizingInductance,
        capacitance: 0,
        peakCurrent: primaryPeakCurrent,
        warnings: ['No suitable core found for the required area product']
      }
    }

    // 5. Primary turns: Np = Lm × Ip_peak / (Bmax × Ae)
    const primaryTurns = Math.ceil(magnetizingInductance * primaryPeakCurrent / (bMax * selectedCore.Ae))

    // 6. Secondary turns: Ns = Np / N
    const secondaryTurns = Math.ceil(primaryTurns / turnsRatio)

    // 7. Output cap: Cout ≥ Iout × D / (fsw × ΔVout)
    const deltaVout = Math.max(voutRippleMax, 0.01 * vout)
    const capacitance = (iout * dMax) / (fsw * deltaVout)

    // 8. Clamp voltage estimate
    const vLeakSpike = 0.1 * vinMax // Estimate leakage spike
    const clampVoltage = vout * turnsRatio + vLeakSpike

    // 9. Losses estimate (simplified)
    const primaryCopperLoss = primaryCurrentAvg ** 2 * 0.1 // Assume 0.1Ω DCR
    const secondaryCopperLoss = iout ** 2 * 0.05 // Assume 0.05Ω DCR
    const coreLoss = 0.5 // W, placeholder
    const mosfetLoss = 2 // W, placeholder
    const diodeLoss = 1 // W, placeholder
    const clampLoss = 0.5 // W, placeholder
    const totalLoss = primaryCopperLoss + secondaryCopperLoss + coreLoss + mosfetLoss + diodeLoss + clampLoss

    const warnings: string[] = []
    if (dMax > 0.45) {
      warnings.push('Duty cycle exceeds 45% - consider DCM or different topology')
    }
    if (!selectedCore) {
      warnings.push('Core saturation risk - increase core size or reduce current')
    }
    if (clampVoltage > 1.5 * vinMax) {
      warnings.push('High clamp voltage - check MOSFET Vds rating')
    }

    return {
      dutyCycle: dMax,
      inductance: magnetizingInductance,
      capacitance,
      peakCurrent: primaryPeakCurrent,
      efficiency: pout / (pout + totalLoss),
      warnings,
      turnsRatio,
      primaryTurns,
      secondaryTurns,
      coreType: selectedCore.type,
      magnetizingInductance,
      clampVoltage,
      losses: {
        primaryCopper: primaryCopperLoss,
        secondaryCopper: secondaryCopperLoss,
        core: coreLoss,
        mosfet: mosfetLoss,
        diode: diodeLoss,
        clamp: clampLoss,
        total: totalLoss
      }
    }
  },

  getTransferFunction(spec, result) {
    return createFlybackTransferFunction(spec, result)
  }
}
