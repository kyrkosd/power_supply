import { DesignSpec, DesignResult, Topology } from '../types'
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
  const suitable = cores.filter(core => core.Ae * core.Aw >= areaProduct)
  if (suitable.length === 0) return null
  return suitable.reduce((min, core) =>
    (core.Ae * core.Aw < min.Ae * min.Aw) ? core : min
  )
}

export const forwardTopology: Topology = {
  id: 'forward',
  name: 'Forward',

  compute(spec: DesignSpec): DesignResult {
    const { vinMin, vout, iout, fsw, rippleRatio, voutRippleMax, efficiency } = spec

    // 1. Reset mechanism: RCD clamp, D_max limited by reset
    const vReset = 15 // V, typical reset winding voltage
    const dMax = vinMin / (vinMin + vReset) // D_max = Vin_min / (Vin_min + Vreset)
    const dutyCycle = Math.min(dMax, vout / (vinMin * dMax)) // Ensure we don't exceed reset limit

    // 2. Turns ratio: N = Vin_min × D_max / Vout
    const turnsRatio = (vinMin * dMax) / vout

    // 3. Output inductor: Lo = (Vout × (1-D)) / (fsw × ΔIL)
    // This is like a buck converter after the transformer
    const pout = vout * iout
    const inputPower = pout / Math.max(efficiency, 0.8)
    const primaryCurrentAvg = inputPower / vinMin
    const rippleFactor = Math.max(rippleRatio, 0.2)
    const deltaIL = rippleFactor * iout // Output current ripple
    const outputInductance = (vout * (1 - dutyCycle)) / (fsw * deltaIL)
    const peakCurrent = iout + deltaIL / 2

    // 4. Output capacitor: same as buck
    const deltaVout = Math.max(voutRippleMax, 0.01 * vout)
    const capacitance = deltaIL / (8 * fsw * deltaVout)

    // 5. Magnetizing inductance: much smaller than flyback
    // Lm = (Vin_min × D_max)² / (2 × Pout × fsw × Ku) where Ku is utilization factor
    const ku = 0.1 // Lower utilization for forward vs flyback
    const magnetizingInductance = (vinMin * dMax) ** 2 / (2 * pout * fsw * ku)

    // 6. Core selection based on magnetizing current
    const bMax = 0.3 // T
    const magnetizingCurrent = (vinMin * dMax) / (fsw * magnetizingInductance)
    const areaProduct = (magnetizingInductance * primaryCurrentAvg * magnetizingCurrent) / (bMax * 400000 * 0.4)
    const selectedCore = selectCore(areaProduct)

    // 7. Transformer turns
    const primaryTurns = selectedCore ? Math.ceil(magnetizingInductance * magnetizingCurrent / (bMax * selectedCore.Ae)) : 10
    const secondaryTurns = Math.ceil(primaryTurns / turnsRatio)

    // 8. MOSFET Vds_max = Vin_max + Vreset

    // 9. Losses
    const primaryCopperLoss = primaryCurrentAvg ** 2 * 0.05 // Ω
    const secondaryCopperLoss = iout ** 2 * 0.02 // Ω
    const outputInductorLoss = iout ** 2 * 0.01 // Ω
    const coreLoss = 0.8 // W
    const mosfetLoss = 3 // W
    const diodeLoss = 2 // W (two diodes)
    const totalLoss = primaryCopperLoss + secondaryCopperLoss + outputInductorLoss + coreLoss + mosfetLoss + diodeLoss

    const warnings: string[] = []
    if (dutyCycle >= dMax) {
      warnings.push('Duty cycle exceeds reset mechanism limit')
    }
    if (!selectedCore) {
      warnings.push('No suitable core found for magnetizing requirements')
    }
    if (turnsRatio < 1) {
      warnings.push('Turns ratio less than 1 - consider different topology')
    }

    const IL_rms = Math.sqrt(iout * iout + (deltaIL * deltaIL) / 12)
    const I_cout_rms = deltaIL / (2 * Math.sqrt(3))

    return {
      dutyCycle,
      inductance: outputInductance, // This is Lo, the output inductor
      capacitance,
      peakCurrent,
      inductor: {
        value: outputInductance,
        peak_current: peakCurrent,
        rms_current: IL_rms,
      },
      output_cap: {
        value: capacitance,
        esr_max: 0.05,
        ripple_current: I_cout_rms,
      },
      efficiency: pout / (pout + totalLoss),
      warnings,
      turnsRatio,
      primaryTurns,
      secondaryTurns,
      coreType: selectedCore?.type,
      magnetizingInductance,
      resetVoltage: vReset,
      rectifierDiodes: 2,
      outputInductance, // Explicitly set this
      losses: {
        primaryCopper: primaryCopperLoss,
        secondaryCopper: secondaryCopperLoss,
        core: coreLoss,
        mosfet: mosfetLoss,
        diode: diodeLoss,
        clamp: 0, // No clamp in forward
        total: totalLoss
      }
    }
  }
}
