import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import type { DesignSpec, DesignResult, TransferFunction } from '../../types'

export function createFlybackTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const D     = result.dutyCycle
  const Lm    = result.magnetizingInductance || result.inductance
  const C     = result.capacitance
  const Rload = spec.vout / spec.iout
  const N     = result.turnsRatio || 1
  const k     = N * (1 - D)
  const omegaRHPZ = (1 - D) ** 2 * Rload / (2 * Math.PI * Lm)
  const omegaP    = 1 / Math.sqrt(Lm * C)

  return {
    numerator:   [k, -k * omegaRHPZ / (2 * Math.PI)],
    denominator: [1, omegaP / (2 * Math.PI), 0],
    evaluate(freq_hz: number) {
      const s   = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ / (2 * Math.PI), complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omegaP / (2 * Math.PI), s)), complex(0, 0))
      const h   = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h as Complex)),
        phase_deg:    arg(h as Complex) * (180 / Math.PI),
      }
    },
  }
}
