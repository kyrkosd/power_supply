import type { DesignSpec, DesignResult } from './types'

export interface EquationVar {
  key: string
  symbol: string       // e.g. 'V_out' — underscore starts subscript
  label: string        // e.g. 'Output Voltage'
  displayUnit: string  // e.g. 'kHz'
  displayScale: number // multiply SI by this for display (e.g. 1e-3 for Hz→kHz)
  min: number          // slider min in display units
  max: number          // slider max in display units
  step: number         // slider step in display units
  extract: (spec: DesignSpec, result: DesignResult | null) => number
}

export interface EquationEntry {
  id: string
  label: string
  symbol: string       // result symbol, e.g. 'L'
  displayUnit: string  // e.g. 'µH'
  displayScale: number // multiply SI result by this for display
  formula: string      // human-readable formula with subscript notation
  substituted: (vars: Record<string, number>, resultSI: number) => string
  evaluate: (vars: Record<string, number>) => number
  variables: EquationVar[]
  description: string
  source_ref: string
  extract: (spec: DesignSpec, result: DesignResult | null) => number | null
}

export function numSuffix(x: number, decimals = 2): string {
  if (Math.abs(x) >= 1e6) return `${(x / 1e6).toFixed(decimals)}M`
  if (Math.abs(x) >= 1e3) return `${(x / 1e3).toFixed(0)}k`
  return x.toFixed(decimals)
}

export const EQUATIONS: EquationEntry[] = [
  // ── 1. Buck Inductance ───────────────────────────────────────────────────────
  {
    id: 'inductance',
    label: 'Inductance (Buck CCM)',
    symbol: 'L',
    displayUnit: 'µH',
    displayScale: 1e6,
    formula: 'L = V_out × (1 − D) / (f_sw × ΔI_L)',
    substituted(vars, L) {
      const d = vars.d, vout = vars.vout, fsw = vars.fsw, dil = vars.deltaIL
      return `L = ${vout.toFixed(2)} × (1 − ${d.toFixed(3)}) / (${numSuffix(fsw, 0)} × ${dil.toFixed(3)}) = ${(L * 1e6).toFixed(3)} µH`
    },
    evaluate({ vout, d, fsw, deltaIL }) {
      if (fsw <= 0 || deltaIL <= 0) return 0
      return (vout * (1 - d)) / (fsw * deltaIL)
    },
    variables: [
      {
        key: 'vout', symbol: 'V_out', label: 'Output Voltage', displayUnit: 'V', displayScale: 1,
        min: 1, max: 60, step: 0.5,
        extract: (s) => s.vout,
      },
      {
        key: 'd', symbol: 'D', label: 'Duty Cycle', displayUnit: '', displayScale: 1,
        min: 0.05, max: 0.95, step: 0.01,
        extract: (_, r) => r?.dutyCycle ?? 0.5,
      },
      {
        key: 'fsw', symbol: 'f_sw', label: 'Switching Frequency', displayUnit: 'kHz', displayScale: 1e-3,
        min: 25, max: 2000, step: 25,
        extract: (s) => s.fsw,
      },
      {
        key: 'deltaIL', symbol: 'ΔI_L', label: 'Inductor Ripple Current', displayUnit: 'A', displayScale: 1,
        min: 0.05, max: 20, step: 0.05,
        extract: (s) => s.rippleRatio * s.iout,
      },
    ],
    description: 'The inductance sets how much the current ramps during each switching cycle. Larger L means smoother (lower ripple) current and a physically larger component. Ripple current ΔI_L is typically chosen as 20–40 % of I_out. Halving the switching frequency doubles the required inductance.',
    source_ref: 'Erickson & Maksimovic, §2.3 eq. 2.30',
    extract: (_, r) => r?.inductance ?? null,
  },

  // ── 2. Buck Output Capacitance ───────────────────────────────────────────────
  {
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
      {
        key: 'deltaIL', symbol: 'ΔI_L', label: 'Inductor Ripple Current', displayUnit: 'A', displayScale: 1,
        min: 0.05, max: 20, step: 0.05,
        extract: (s) => s.rippleRatio * s.iout,
      },
      {
        key: 'fsw', symbol: 'f_sw', label: 'Switching Frequency', displayUnit: 'kHz', displayScale: 1e-3,
        min: 25, max: 2000, step: 25,
        extract: (s) => s.fsw,
      },
      {
        key: 'deltaVout', symbol: 'ΔV_out', label: 'Output Ripple Voltage', displayUnit: 'mV', displayScale: 1e3,
        min: 1, max: 500, step: 1,
        extract: (s) => s.voutRippleMax,
      },
    ],
    description: 'The output capacitor filters the triangular inductor current ripple into a smooth DC output. It only needs to handle the portion of ripple that cannot be stored in the inductor itself — hence the factor of 8 in the denominator. Higher f_sw and tighter ripple spec both push C down, often allowing cheaper, smaller ceramics.',
    source_ref: 'Erickson & Maksimovic, §2.3 eq. 2.44',
    extract: (_, r) => r?.capacitance ?? null,
  },

  // ── 3. Buck Duty Cycle ───────────────────────────────────────────────────────
  {
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
      {
        key: 'vout', symbol: 'V_out', label: 'Output Voltage', displayUnit: 'V', displayScale: 1,
        min: 0.5, max: 60, step: 0.5,
        extract: (s) => s.vout,
      },
      {
        key: 'vin', symbol: 'V_in', label: 'Input Voltage', displayUnit: 'V', displayScale: 1,
        min: 1, max: 120, step: 1,
        extract: (s) => s.vinMax,
      },
    ],
    description: 'For a buck converter in CCM, the duty cycle is simply the ratio of output to input voltage — independent of load current. D < 0.1 creates narrow pulses that stress the gate driver. D > 0.9 leaves very little off-time for the output capacitor to discharge, making the compensator design difficult.',
    source_ref: 'Erickson & Maksimovic, Table 2-1',
    extract: (_, r) => r?.dutyCycle ?? null,
  },

  // ── 4. Efficiency ────────────────────────────────────────────────────────────
  {
    id: 'efficiency',
    label: 'Converter Efficiency',
    symbol: 'η',
    displayUnit: '%',
    displayScale: 100,
    formula: 'η = P_out / (P_out + P_loss)',
    substituted(vars, eta) {
      const pout = vars.pout, ploss = vars.ploss
      return `η = ${pout.toFixed(3)} / (${pout.toFixed(3)} + ${ploss.toFixed(3)}) = ${(eta * 100).toFixed(2)} %`
    },
    evaluate({ pout, ploss }) {
      const denom = pout + ploss
      if (denom <= 0) return 0
      return pout / denom
    },
    variables: [
      {
        key: 'pout', symbol: 'P_out', label: 'Output Power', displayUnit: 'W', displayScale: 1,
        min: 0.1, max: 500, step: 0.5,
        extract: (s) => s.vout * s.iout,
      },
      {
        key: 'ploss', symbol: 'P_loss', label: 'Total Power Loss', displayUnit: 'W', displayScale: 1,
        min: 0.01, max: 100, step: 0.05,
        extract: (_, r) => r?.losses?.total ?? 1,
      },
    ],
    description: 'Efficiency is the fraction of input power that reaches the load. Every watt of loss generates heat and reduces battery life. At light load, fixed losses (gate drive, core) dominate and efficiency drops — this is the crossover region where synchronous rectification often hurts rather than helps.',
    source_ref: 'Erickson & Maksimovic, §3.3',
    extract: (_, r) => r?.efficiency ?? null,
  },

  // ── 5. LC Corner Frequency (Phase Margin reference) ─────────────────────────
  {
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
      {
        key: 'l', symbol: 'L', label: 'Inductance', displayUnit: 'µH', displayScale: 1e6,
        min: 0.1, max: 1000, step: 0.1,
        extract: (_, r) => r?.inductance ?? 10e-6,
      },
      {
        key: 'c', symbol: 'C', label: 'Output Capacitance', displayUnit: 'µF', displayScale: 1e6,
        min: 0.1, max: 2000, step: 1,
        extract: (_, r) => r?.capacitance ?? 100e-6,
      },
    ],
    description: 'The LC corner frequency is the undamped natural resonant frequency of the output filter. It appears as a double pole in the control-to-output transfer function, introducing up to 180° of phase lag. The compensator crossover frequency f_c should be designed well below f₀ (voltage mode) or can exceed f₀ with a properly designed current-mode loop.',
    source_ref: 'Erickson & Maksimovic, §9.2; TI SLVA477B §4',
    extract: (_, r) => {
      if (!r?.inductance || !r?.capacitance) return null
      return 1 / (2 * Math.PI * Math.sqrt(r.inductance * r.capacitance))
    },
  },

  // ── 6. MOSFET Conduction Loss ────────────────────────────────────────────────
  {
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
      {
        key: 'rds', symbol: 'R_ds', label: 'MOSFET On-Resistance', displayUnit: 'mΩ', displayScale: 1e3,
        min: 1, max: 200, step: 1,
        extract: () => 20, // DEVICE_ASSUMPTIONS constant = 20 mΩ
      },
      {
        key: 'iout', symbol: 'I_out', label: 'Output Current', displayUnit: 'A', displayScale: 1,
        min: 0.1, max: 50, step: 0.1,
        extract: (s) => s.iout,
      },
      {
        key: 'd', symbol: 'D', label: 'Duty Cycle', displayUnit: '', displayScale: 1,
        min: 0.05, max: 0.95, step: 0.01,
        extract: (_, r) => r?.dutyCycle ?? 0.5,
      },
    ],
    description: 'Conduction loss in the high-side MOSFET comes from current flowing through its channel resistance R_ds(on). It scales with I² so doubling the load current quadruples the loss. Choosing a lower R_ds(on) FET is the most direct way to reduce this loss, but lower R_ds(on) usually means higher gate charge Q_g — this tradeoff is quantified by the figure of merit R_ds × Q_g.',
    source_ref: 'TI SLUA618; Vishay AN605',
    extract: (_, r) => r?.losses?.mosfet_conduction ?? null,
  },

  // ── 7. MOSFET Switching Loss ─────────────────────────────────────────────────
  {
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
      {
        key: 'vin', symbol: 'V_in', label: 'Input Voltage', displayUnit: 'V', displayScale: 1,
        min: 1, max: 120, step: 1,
        extract: (s) => s.vinMax,
      },
      {
        key: 'ipk', symbol: 'I_pk', label: 'Peak Current at Switch', displayUnit: 'A', displayScale: 1,
        min: 0.1, max: 50, step: 0.1,
        extract: (_, r) => r?.peakCurrent ?? 3,
      },
      {
        key: 'tsw', symbol: 't_sw', label: 'Rise + Fall Time (t_r + t_f)', displayUnit: 'ns', displayScale: 1e9,
        min: 5, max: 200, step: 5,
        extract: () => 50e-9, // 25ns rise + 25ns fall
      },
      {
        key: 'fsw', symbol: 'f_sw', label: 'Switching Frequency', displayUnit: 'kHz', displayScale: 1e-3,
        min: 25, max: 2000, step: 25,
        extract: (s) => s.fsw,
      },
    ],
    description: 'Switching loss occurs during the transition intervals when both V_ds and I_d are simultaneously non-zero — energy is dissipated in the FET channel and heat is generated. Unlike conduction loss, switching loss is proportional to f_sw, so halving the frequency halves it. The tradeoff: lower f_sw requires larger L and C. Faster FETs (lower t_sw) reduce switching loss at the cost of higher dV/dt and EMI.',
    source_ref: 'TI SLUA618 eq. 3; Erickson & Maksimovic, §4.2',
    extract: (_, r) => r?.losses?.mosfet_switching ?? null,
  },
]

export function findEquation(id: string): EquationEntry | undefined {
  return EQUATIONS.find((e) => e.id === id)
}
