// Field definitions, slider math helpers, and shared defaults for InputPanel sub-components.
import type { DesignSpec }      from '../../engine/types'
import type { SecondaryOutput } from '../../engine/types'

// ── Field descriptor ──────────────────────────────────────────────────────────

/** Metadata for one numeric spec input: key, display labels, range, optional scaling/log. */
export interface FieldDef {
  key:      keyof DesignSpec
  label:    string
  unit:     string
  min:      number
  max:      number
  step:     number
  decimals: number
  /** Converts raw SI value to display unit (e.g. 1000 for Hz→kHz). */
  scale?: number
  /** When true the range input operates in log10 space. */
  log?: boolean
  tooltip?: string
}

// ── Field catalogs ────────────────────────────────────────────────────────────

/** Specifications section fields — shared across all topologies. */
export const SPEC_FIELDS_BASE: FieldDef[] = [
  { key: 'vinMin', label: 'Vin min', unit: 'V', min: 1, max: 1000, step: 0.1, decimals: 1,
    tooltip: 'Minimum input voltage. Lower voltage = smaller inductor but higher current stress.' },
  { key: 'vinMax', label: 'Vin max', unit: 'V', min: 1, max: 1000, step: 0.1, decimals: 1,
    tooltip: 'Maximum input voltage. Higher voltage = larger MOSFET voltage rating required.' },
  { key: 'vout', label: 'Vout', unit: 'V', min: 0.5, max: 500, step: 0.1, decimals: 2,
    tooltip: 'Output voltage setpoint. The tool will calculate duty cycle and component values to achieve this.' },
  { key: 'iout', label: 'Iout', unit: 'A', min: 0.01, max: 50, step: 0.1, decimals: 2,
    tooltip: 'Output current. Higher current = larger inductor and capacitor ripple current ratings.' },
]

/** Vout override for buck-boost topology (negative output voltage). */
export const VOUT_BUCK_BOOST: FieldDef = {
  key: 'vout', label: 'Vout', unit: 'V', min: -500, max: -0.1, step: 0.1, decimals: 2,
  tooltip: 'Output voltage for buck-boost. Enter as a negative value (e.g. −5 V for a −5 V rail).',
}

/** Operating parameters section fields. */
export const OPERATING_FIELDS: FieldDef[] = [
  { key: 'fsw', label: 'Switching freq', unit: 'kHz',
    min: 1_000, max: 5_000_000, step: 1, decimals: 0, scale: 1000, log: true,
    tooltip: 'Switching frequency. Higher = smaller L/C but higher switching losses & EMI. Typical: 100 kHz–2 MHz.' },
  { key: 'rippleRatio', label: 'Ripple ratio', unit: '',
    min: 0.05, max: 0.8, step: 0.01, decimals: 2,
    tooltip: 'Inductor current ripple as fraction of Iout. Higher = smaller L but larger ripple. Typical: 0.2–0.4.' },
  { key: 'ambientTemp', label: 'Ambient temp', unit: '°C',
    min: -40, max: 125, step: 1, decimals: 0,
    tooltip: 'Ambient temperature. Used to calculate junction temperature and thermal margins.' },
]

/** Design targets section fields. */
export const TARGET_FIELDS: FieldDef[] = [
  { key: 'voutRippleMax', label: 'Vout ripple max', unit: 'mV',
    min: 0.001, max: 5, step: 0.001, decimals: 0, scale: 1000,
    tooltip: 'Maximum allowed output voltage ripple (peak-to-peak). Larger Cout reduces ripple but increases size/cost.' },
  { key: 'efficiency', label: 'Efficiency target', unit: '%',
    min: 0.5, max: 0.99, step: 0.01, decimals: 0, scale: 0.01,
    tooltip: 'Target efficiency. Typical: 85–95 %.' },
]

/** Default values for a new secondary output winding (flyback multi-output mode). */
export const DEFAULT_SECONDARY: SecondaryOutput = { vout: 12, iout: 0.5, diode_vf: 0.4, is_regulated: false }

// ── Slider math helpers ───────────────────────────────────────────────────────

/** Convert raw SI value to display-unit value via the field's scale factor. */
export function toDisplay(field: FieldDef, raw: number): number {
  return field.scale ? raw / field.scale : raw
}

/** Convert display-unit value back to raw SI value. */
export function toRaw(field: FieldDef, display: number): number {
  return field.scale ? display * field.scale : display
}

/** Current range-input position: log10 of absolute value for log fields, else display unit. */
export function sliderValue(field: FieldDef, raw: number): number {
  return field.log ? Math.log10(Math.abs(raw)) : toDisplay(field, raw)
}

/** Range-input minimum: log10(min) for log fields, else scaled min. */
export function sliderMin(field: FieldDef): number {
  return field.log ? Math.log10(Math.abs(field.min)) : (field.scale ? field.min / field.scale : field.min)
}

/** Range-input maximum: log10(max) for log fields, else scaled max. */
export function sliderMax(field: FieldDef): number {
  return field.log ? Math.log10(Math.abs(field.max)) : (field.scale ? field.max / field.scale : field.max)
}

/** Step size for the HTML range input (0.01 for log-scaled fields). */
export function sliderStep(field: FieldDef): number {
  return field.log ? 0.01 : field.step
}

/** Format a numeric display value to the given decimal places; returns '—' for non-finite values. */
export function formatDisplay(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '—'
}
