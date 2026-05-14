import type { EquationEntry } from './types'

// Buck CCM duty cycle: D = Vout / Vin. Erickson & Maksimovic Table 2-1.
export function mkDutyCycleEq(): EquationEntry {
  return {
    id: 'duty_cycle',
    label: 'Duty Cycle (Buck CCM)',
    symbol: 'D',
    displayUnit: '%',
    displayScale: 100,
    formula: 'D = V_out / V_in',
    substituted(vars, D) {
      return `D = ${vars.vout.toFixed(2)} / ${vars.vin.toFixed(2)} = ${(D * 100).toFixed(2)} %`
    },
    evaluate({ vout, vin }) {
      if (vin <= 0) return 0
      return Math.min(Math.max(vout / vin, 0.01), 0.99)
    },
    variables: [
      { key: 'vout', symbol: 'V_out', label: 'Output Voltage', displayUnit: 'V', displayScale: 1, min: 0.5, max: 60,  step: 0.5, extract: (s) => s.vout },
      { key: 'vin',  symbol: 'V_in',  label: 'Input Voltage',  displayUnit: 'V', displayScale: 1, min: 1,   max: 120, step: 1,   extract: (s) => s.vinMax },
    ],
    description: 'For a buck converter in CCM, the duty cycle is simply the ratio of output to input voltage — independent of load current. D < 0.1 creates narrow pulses that stress the gate driver. D > 0.9 leaves very little off-time for the output capacitor to discharge, making the compensator design difficult.',
    source_ref: 'Erickson & Maksimovic, Table 2-1',
    extract: (_, r) => r?.dutyCycle ?? null,
  }
}
