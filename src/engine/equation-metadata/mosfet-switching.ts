import type { EquationEntry } from './types'
import { numSuffix } from './types'

// MOSFET switching loss: P_sw = ½·Vin·Ipk·tsw·fsw. TI SLUA618 eq. 3; Erickson & Maksimovic §4.2.
export function mkMosfetSwitchingEq(): EquationEntry {
  return {
    id: 'mosfet_switching',
    label: 'MOSFET Switching Loss',
    symbol: 'P_sw',
    displayUnit: 'W',
    displayScale: 1,
    formula: 'P_sw = ½ × V_in × I_pk × t_sw × f_sw',
    substituted(vars, P) {
      return `P_sw = 0.5 × ${vars.vin.toFixed(1)} × ${vars.ipk.toFixed(3)} × ${(vars.tsw * 1e9).toFixed(0)}ns × ${numSuffix(vars.fsw, 0)} = ${P.toFixed(4)} W`
    },
    evaluate({ vin, ipk, tsw, fsw }) {
      return 0.5 * vin * ipk * tsw * fsw
    },
    variables: [
      { key: 'vin', symbol: 'V_in',  label: 'Input Voltage',               displayUnit: 'V',   displayScale: 1,    min: 1,   max: 120,  step: 1,   extract: (s) => s.vinMax },
      { key: 'ipk', symbol: 'I_pk',  label: 'Peak Current at Switch',       displayUnit: 'A',   displayScale: 1,    min: 0.1, max: 50,   step: 0.1, extract: (_, r) => r?.peakCurrent ?? 3 },
      { key: 'tsw', symbol: 't_sw',  label: 'Rise + Fall Time (t_r + t_f)', displayUnit: 'ns',  displayScale: 1e9,  min: 5,   max: 200,  step: 5,   extract: () => 50e-9 },
      { key: 'fsw', symbol: 'f_sw',  label: 'Switching Frequency',          displayUnit: 'kHz', displayScale: 1e-3, min: 25,  max: 2000, step: 25,  extract: (s) => s.fsw },
    ],
    description: 'Switching loss occurs during the transition intervals when both V_ds and I_d are simultaneously non-zero — energy is dissipated in the FET channel and heat is generated. Unlike conduction loss, switching loss is proportional to f_sw, so halving the frequency halves it. The tradeoff: lower f_sw requires larger L and C. Faster FETs (lower t_sw) reduce switching loss at the cost of higher dV/dt and EMI.',
    source_ref: 'TI SLUA618 eq. 3; Erickson & Maksimovic, §4.2',
    extract: (_, r) => r?.losses?.mosfet_switching ?? null,
  }
}
