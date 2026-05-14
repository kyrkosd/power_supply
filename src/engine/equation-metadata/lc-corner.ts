import type { EquationEntry } from './types'

// LC corner frequency: f₀ = 1 / (2π·√(L·C)). Erickson & Maksimovic §9.2; TI SLVA477B §4.
export function mkLcCornerEq(): EquationEntry {
  return {
    id: 'lc_corner',
    label: 'LC Corner Frequency',
    symbol: 'f₀',
    displayUnit: 'kHz',
    displayScale: 1e-3,
    formula: 'f₀ = 1 / (2π × √(L × C))',
    substituted(vars, f0) {
      return `f₀ = 1 / (2π × √(${(vars.l * 1e6).toFixed(3)}µ × ${(vars.c * 1e6).toFixed(3)}µ)) = ${(f0 * 1e-3).toFixed(3)} kHz`
    },
    evaluate({ l, c }) {
      if (l <= 0 || c <= 0) return 0
      return 1 / (2 * Math.PI * Math.sqrt(l * c))
    },
    variables: [
      { key: 'l', symbol: 'L', label: 'Inductance',         displayUnit: 'µH', displayScale: 1e6, min: 0.1, max: 1000, step: 0.1, extract: (_, r) => r?.inductance ?? 10e-6 },
      { key: 'c', symbol: 'C', label: 'Output Capacitance', displayUnit: 'µF', displayScale: 1e6, min: 0.1, max: 2000, step: 1,   extract: (_, r) => r?.capacitance ?? 100e-6 },
    ],
    description: 'The LC corner frequency is the undamped natural resonant frequency of the output filter. It appears as a double pole in the control-to-output transfer function, introducing up to 180° of phase lag. The compensator crossover frequency f_c should be designed well below f₀ (voltage mode) or can exceed f₀ with a properly designed current-mode loop.',
    source_ref: 'Erickson & Maksimovic, §9.2; TI SLVA477B §4',
    extract: (_, r) => {
      if (!r?.inductance || !r?.capacitance) return null
      return 1 / (2 * Math.PI * Math.sqrt(r.inductance * r.capacitance))
    },
  }
}
