import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import type { DesignSpec, DesignResult } from '../../types'

// Erickson & Maksimovic 3rd ed., §8.2.1 — boost control-to-output.
// Double pole at ω₀ = 1/√(LC); RHP zero at frhpz = (1-D)²·R / (2π·L).
export function createBoostTransferFunction(spec: DesignSpec, result: DesignResult) {
  const D     = result.dutyCycle
  const L     = result.inductance
  const C     = result.capacitance
  const Rload = spec.vout / spec.iout
  const k     = spec.vout / (1 - D)
  const frhpz = ((1 - D) ** 2 * Rload) / (2 * Math.PI * L)
  const omegaRHPZ = 2 * Math.PI * frhpz
  const omega0    = 1 / Math.sqrt(L * C)

  return {
    numerator:   [k, -k * omegaRHPZ],
    denominator: [1, omega0, 0],
    evaluate(freq_hz: number) {
      const s   = complex(0, 2 * Math.PI * freq_hz)
      const num = add(multiply(k, s), multiply(-k * omegaRHPZ, complex(1, 0)))
      const den = add(add(multiply(s, s), multiply(omega0, s)), complex(0, 0))
      const h   = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h as Complex)),
        phase_deg:    arg(h as Complex) * (180 / Math.PI),
      }
    },
  }
}
