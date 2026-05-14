import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'
import type { DesignSpec, DesignResult, TransferFunction } from '../../types'

// Buck-derived topology → LC double pole only, no RHP zero.
// H(s) = K·ω₀² / (s² + (ω₀/Q)·s + ω₀²)
// Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §8.2.3.
export function createForwardTransferFunction(spec: DesignSpec, result: DesignResult): TransferFunction {
  const Lo    = result.outputInductance ?? result.inductance
  const C     = result.capacitance
  const D     = result.dutyCycle
  const Rload = spec.vout / spec.iout

  const k_dc   = spec.vout / D                // Erickson eq. 8.37: DC gain K = Vout/D
  const omega0  = 1 / Math.sqrt(Lo * C)       // Erickson eq. 8.38: ω₀ = 1/√(Lo·Cout)
  const Q       = Rload * Math.sqrt(C / Lo)   // Q = R_load·√(Cout/Lo)

  return {
    numerator:   [k_dc * omega0 ** 2],
    denominator: [1, omega0 / Q, omega0 ** 2],
    evaluate(freq_hz: number) {
      const s   = complex(0, 2 * Math.PI * freq_hz)
      const num = complex(k_dc * omega0 ** 2, 0)
      const den = add(add(multiply(s, s), multiply(omega0 / Q, s)), complex(omega0 ** 2, 0))
      const h   = divide(num, den)
      return {
        magnitude_db: 20 * Math.log10(abs(h as Complex)),
        phase_deg:    arg(h as Complex) * (180 / Math.PI),
      }
    },
  }
}
