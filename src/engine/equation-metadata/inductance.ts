import type { EquationEntry } from './types'
import { numSuffix } from './types'

// Buck CCM inductance: L = Vout·(1−D) / (fsw·ΔIL). Erickson & Maksimovic §2.3 eq. 2.30.
export function mkInductanceEq(): EquationEntry {
  return {
    id: 'inductance',
    label: 'Inductance (Buck CCM)',
    symbol: 'L',
    displayUnit: 'µH',
    displayScale: 1e6,
    formula: 'L = V_out × (1 − D) / (f_sw × ΔI_L)',
    substituted(vars, L) {
      const { d, vout, fsw, deltaIL } = vars
      return `L = ${vout.toFixed(2)} × (1 − ${d.toFixed(3)}) / (${numSuffix(fsw, 0)} × ${deltaIL.toFixed(3)}) = ${(L * 1e6).toFixed(3)} µH`
    },
    evaluate({ vout, d, fsw, deltaIL }) {
      if (fsw <= 0 || deltaIL <= 0) return 0
      return (vout * (1 - d)) / (fsw * deltaIL)
    },
    variables: [
      { key: 'vout',    symbol: 'V_out', label: 'Output Voltage',        displayUnit: 'V',   displayScale: 1,    min: 1,    max: 60,   step: 0.5,  extract: (s) => s.vout },
      { key: 'd',       symbol: 'D',     label: 'Duty Cycle',             displayUnit: '',    displayScale: 1,    min: 0.05, max: 0.95, step: 0.01, extract: (_, r) => r?.dutyCycle ?? 0.5 },
      { key: 'fsw',     symbol: 'f_sw',  label: 'Switching Frequency',    displayUnit: 'kHz', displayScale: 1e-3, min: 25,   max: 2000, step: 25,   extract: (s) => s.fsw },
      { key: 'deltaIL', symbol: 'ΔI_L',  label: 'Inductor Ripple Current', displayUnit: 'A',  displayScale: 1,    min: 0.05, max: 20,   step: 0.05, extract: (s) => s.rippleRatio * s.iout },
    ],
    description: 'The inductance sets how much the current ramps during each switching cycle. Larger L means smoother (lower ripple) current and a physically larger component. Ripple current ΔI_L is typically chosen as 20–40 % of I_out. Halving the switching frequency doubles the required inductance.',
    source_ref: 'Erickson & Maksimovic, §2.3 eq. 2.30',
    extract: (_, r) => r?.inductance ?? null,
  }
}
