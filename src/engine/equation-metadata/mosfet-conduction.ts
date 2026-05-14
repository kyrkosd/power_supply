import type { EquationEntry } from './types'

// MOSFET conduction loss: P_cond = Rds·Iout²·D. TI SLUA618; Vishay AN605.
export function mkMosfetConductionEq(): EquationEntry {
  return {
    id: 'mosfet_conduction',
    label: 'MOSFET Conduction Loss',
    symbol: 'P_cond',
    displayUnit: 'W',
    displayScale: 1,
    formula: 'P_cond = R_ds × I_out² × D',
    substituted(vars, P) {
      return `P_cond = ${(vars.rds * 1e3).toFixed(1)}mΩ × ${vars.iout.toFixed(2)}² × ${vars.d.toFixed(3)} = ${P.toFixed(4)} W`
    },
    evaluate({ rds, iout, d }) {
      return rds * iout * iout * d
    },
    variables: [
      { key: 'rds',  symbol: 'R_ds',  label: 'MOSFET On-Resistance', displayUnit: 'mΩ', displayScale: 1e3, min: 1,    max: 200,  step: 1,    extract: () => 20 },
      { key: 'iout', symbol: 'I_out', label: 'Output Current',        displayUnit: 'A',  displayScale: 1,   min: 0.1,  max: 50,   step: 0.1,  extract: (s) => s.iout },
      { key: 'd',    symbol: 'D',     label: 'Duty Cycle',             displayUnit: '',   displayScale: 1,   min: 0.05, max: 0.95, step: 0.01, extract: (_, r) => r?.dutyCycle ?? 0.5 },
    ],
    description: 'Conduction loss in the high-side MOSFET comes from current flowing through its channel resistance R_ds(on). It scales with I² so doubling the load current quadruples the loss. Choosing a lower R_ds(on) FET is the most direct way to reduce this loss, but lower R_ds(on) usually means higher gate charge Q_g — this tradeoff is quantified by the figure of merit R_ds × Q_g.',
    source_ref: 'TI SLUA618; Vishay AN605',
    extract: (_, r) => r?.losses?.mosfet_conduction ?? null,
  }
}
