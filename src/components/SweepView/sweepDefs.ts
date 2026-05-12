// Metric definitions, parameter definitions, and helpers for the Parameter Sweep view.
import type { SweepParam, SweepPoint } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Typical SO-8 junction-to-ambient thermal resistance (°C/W). */
export const THETA_JA = 40

/** Default set of metric keys shown on first open. */
export const DEFAULT_CHECKED = new Set(['inductance', 'capacitance', 'dutyCycle', 'efficiency', 'losses'])

// ── Spec override ─────────────────────────────────────────────────────────────

/** Returns a copy of `base` with the swept parameter set to `v` (in SI units). */
export function effectiveSpec(base: DesignSpec, param: SweepParam, v: number): DesignSpec {
  switch (param) {
    case 'vin':          return { ...base, vinMin: v, vinMax: v }
    case 'vout':         return { ...base, vout: v }
    case 'iout':         return { ...base, iout: v }
    case 'fsw':          return { ...base, fsw: v }
    case 'ripple_ratio': return { ...base, rippleRatio: v }
    case 'ambient_temp': return { ...base, ambientTemp: v }
  }
}

// ── Metric definitions ────────────────────────────────────────────────────────

/** Definition for one sweep chart metric: label, color, and value extractor. */
export interface MetricDef {
  key:        string
  label:      string
  shortLabel: string
  unit:       string
  color:      string
  get: (pt: SweepPoint, param: SweepParam, base: DesignSpec) => number | null
}

export const METRICS: MetricDef[] = [
  {
    key: 'inductance', label: 'Inductance', shortLabel: 'L', unit: 'µH', color: '#32c9e6',
    get: (pt) => pt.result ? pt.result.inductance * 1e6 : null,
  },
  {
    key: 'capacitance', label: 'Output Cap', shortLabel: 'C', unit: 'µF', color: '#22c55e',
    get: (pt) => pt.result ? pt.result.capacitance * 1e6 : null,
  },
  {
    key: 'dutyCycle', label: 'Duty Cycle', shortLabel: 'D', unit: '%', color: '#f59e0b',
    get: (pt) => pt.result ? pt.result.dutyCycle * 100 : null,
  },
  {
    key: 'efficiency', label: 'Efficiency', shortLabel: 'η', unit: '%', color: '#a78bfa',
    get: (pt) => pt.result?.efficiency != null ? pt.result.efficiency * 100 : null,
  },
  {
    key: 'losses', label: 'Total Losses', shortLabel: 'P_loss', unit: 'W', color: '#f97316',
    get: (pt) => pt.result?.losses?.total ?? null,
  },
  {
    key: 'phaseMargin', label: 'Phase Margin', shortLabel: 'PM', unit: '°', color: '#38bdf8',
    get: (pt) => pt.phaseMargin,
  },
  {
    key: 'mosfetTj', label: 'MOSFET Tj', shortLabel: 'Tj', unit: '°C', color: '#ef4444',
    get: (pt, param, base) => {
      if (!pt.result) return null
      const spec = effectiveSpec(base, param, pt.paramValue)
      const loss = (pt.result.losses?.mosfet_conduction ?? 0) + (pt.result.losses?.mosfet_switching ?? 0)
      return spec.ambientTemp + loss * THETA_JA
    },
  },
  {
    key: 'outputRipple', label: 'Output Ripple', shortLabel: 'ΔV', unit: 'mV', color: '#84cc16',
    get: (pt, param, base) => {
      if (!pt.result || pt.result.capacitance <= 0) return null
      const spec = effectiveSpec(base, param, pt.paramValue)
      return (spec.rippleRatio * spec.iout / (8 * spec.fsw * pt.result.capacitance)) * 1000
    },
  },
  {
    key: 'ccmBoundary', label: 'CCM Boundary', shortLabel: 'I_crit', unit: 'A', color: '#e879f9',
    get: (pt) => pt.result?.ccm_dcm_boundary ?? null,
  },
]

// ── Parameter definitions ─────────────────────────────────────────────────────

/** Definition for one sweepable parameter: display label, unit, scale, and default range. */
export interface ParamDef {
  key:          SweepParam
  label:        string
  unit:         string
  displayScale: number   // display_value × displayScale = SI value
  decimals:     number
  defaultRange: (spec: DesignSpec) => [number, number]   // display units
}

export const PARAM_DEFS: ParamDef[] = [
  {
    key: 'vin', label: 'Input Voltage (Vin)', unit: 'V', displayScale: 1, decimals: 1,
    defaultRange: (s) => [+(s.vinMin * 0.5).toFixed(1), +(s.vinMax * 2.0).toFixed(1)],
  },
  {
    key: 'vout', label: 'Output Voltage (Vout)', unit: 'V', displayScale: 1, decimals: 2,
    defaultRange: (s) => [+(s.vout * 0.5).toFixed(2), +(s.vout * 2.0).toFixed(2)],
  },
  {
    key: 'iout', label: 'Output Current (Iout)', unit: 'A', displayScale: 1, decimals: 2,
    defaultRange: (s) => [+(s.iout * 0.2).toFixed(2), +(s.iout * 3.0).toFixed(2)],
  },
  {
    key: 'fsw', label: 'Switching Freq (fsw)', unit: 'kHz', displayScale: 1000, decimals: 0,
    defaultRange: (s) => [Math.round(s.fsw / 1000 * 0.2), Math.round(s.fsw / 1000 * 4)],
  },
  {
    key: 'ripple_ratio', label: 'Ripple Ratio (ΔIL/Iout)', unit: '', displayScale: 1, decimals: 2,
    defaultRange: () => [0.05, 0.80],
  },
  {
    key: 'ambient_temp', label: 'Ambient Temp (Ta)', unit: '°C', displayScale: 1, decimals: 0,
    defaultRange: () => [-20, 85],
  },
]

/** Returns the `ParamDef` for the given sweep parameter key. */
export function getParamDef(key: SweepParam): ParamDef {
  return PARAM_DEFS.find((p) => p.key === key)!
}

/** Reads the current SI value of the swept parameter from the design spec. */
export function getCurrentParamSI(spec: DesignSpec, param: SweepParam): number {
  switch (param) {
    case 'vin':          return (spec.vinMin + spec.vinMax) / 2
    case 'vout':         return spec.vout
    case 'iout':         return spec.iout
    case 'fsw':          return spec.fsw
    case 'ripple_ratio': return spec.rippleRatio
    case 'ambient_temp': return spec.ambientTemp
  }
}
