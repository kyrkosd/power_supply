import type { EquationEntry } from './types'

// Converter efficiency: η = Pout / (Pout + Ploss). Erickson & Maksimovic §3.3.
export function mkEfficiencyEq(): EquationEntry {
  return {
    id: 'efficiency',
    label: 'Converter Efficiency',
    symbol: 'η',
    displayUnit: '%',
    displayScale: 100,
    formula: 'η = P_out / (P_out + P_loss)',
    substituted(vars, eta) {
      const { pout, ploss } = vars
      return `η = ${pout.toFixed(3)} / (${pout.toFixed(3)} + ${ploss.toFixed(3)}) = ${(eta * 100).toFixed(2)} %`
    },
    evaluate({ pout, ploss }) {
      const denom = pout + ploss
      if (denom <= 0) return 0
      return pout / denom
    },
    variables: [
      { key: 'pout',  symbol: 'P_out',  label: 'Output Power',    displayUnit: 'W', displayScale: 1, min: 0.1,  max: 500, step: 0.5,  extract: (s) => s.vout * s.iout },
      { key: 'ploss', symbol: 'P_loss', label: 'Total Power Loss', displayUnit: 'W', displayScale: 1, min: 0.01, max: 100, step: 0.05, extract: (_, r) => r?.losses?.total ?? 1 },
    ],
    description: 'Efficiency is the fraction of input power that reaches the load. Every watt of loss generates heat and reduces battery life. At light load, fixed losses (gate drive, core) dominate and efficiency drops — this is the crossover region where synchronous rectification often hurts rather than helps.',
    source_ref: 'Erickson & Maksimovic, §3.3',
    extract: (_, r) => r?.efficiency ?? null,
  }
}
