import type { EquationEntry } from './types'
import { numSuffix } from './types'

// Buck CCM output capacitance: C = ΔIL / (8·fsw·ΔVout). Erickson & Maksimovic §2.3 eq. 2.44.
export function mkCapacitanceEq(): EquationEntry {
  return {
    id: 'capacitance',
    label: 'Output Capacitance (Buck CCM)',
    symbol: 'C',
    displayUnit: 'µF',
    displayScale: 1e6,
    formula: 'C = ΔI_L / (8 × f_sw × ΔV_out)',
    substituted(vars, C) {
      return `C = ${vars.deltaIL.toFixed(3)} / (8 × ${numSuffix(vars.fsw, 0)} × ${(vars.deltaVout * 1e3).toFixed(2)}m) = ${(C * 1e6).toFixed(3)} µF`
    },
    evaluate({ deltaIL, fsw, deltaVout }) {
      if (fsw <= 0 || deltaVout <= 0) return 0
      return deltaIL / (8 * fsw * deltaVout)
    },
    variables: [
      { key: 'deltaIL',   symbol: 'ΔI_L',   label: 'Inductor Ripple Current', displayUnit: 'A',   displayScale: 1,    min: 0.05, max: 20,   step: 0.05, extract: (s) => s.rippleRatio * s.iout },
      { key: 'fsw',       symbol: 'f_sw',    label: 'Switching Frequency',     displayUnit: 'kHz', displayScale: 1e-3, min: 25,   max: 2000, step: 25,   extract: (s) => s.fsw },
      { key: 'deltaVout', symbol: 'ΔV_out',  label: 'Output Ripple Voltage',   displayUnit: 'mV',  displayScale: 1e3,  min: 1,    max: 500,  step: 1,    extract: (s) => s.voutRippleMax },
    ],
    description: 'The output capacitor filters the triangular inductor current ripple into a smooth DC output. It only needs to handle the portion of ripple that cannot be stored in the inductor itself — hence the factor of 8 in the denominator. Higher f_sw and tighter ripple spec both push C down, often allowing cheaper, smaller ceramics.',
    source_ref: 'Erickson & Maksimovic, §2.3 eq. 2.44',
    extract: (_, r) => r?.capacitance ?? null,
  }
}
