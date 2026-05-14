import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import type { DesignSpec, DesignResult } from '../../types'

// Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §8.2.2.
// Structure is identical to boost: double pole at ω₀ = (1−D)/√(LC),
// RHP zero at ωz = (1−D)²·R/L.
export function createBuckBoostTransferFunction(spec: DesignSpec, result: DesignResult) {
  const D       = result.dutyCycle
  const L       = result.inductor!.value
  const C       = result.output_cap!.value
  const voutMag = Math.abs(spec.vout)
  const Rload   = voutMag / spec.iout

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
