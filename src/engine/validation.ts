import type { DesignSpec } from './types'
import type { TopologyId } from '../store/workbenchStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Returns true when `x` is a finite number strictly greater than zero. */
function isPositiveFinite(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0
}

/** Constructs a ValidationError. Severity defaults to `'error'`. */
function err(
  field: string,
  message: string,
  severity: ValidationError['severity'] = 'error',
): ValidationError {
  return { field, message, severity }
}

// ── Section validators ────────────────────────────────────────────────────────

/**
 * Checks that Vin_min and Vin_max are positive, finite, and correctly ordered.
 */
function validateInputVoltages(spec: DesignSpec): ValidationError[] {
  const { vinMin, vinMax } = spec
  const errors: ValidationError[] = []

  if (!isPositiveFinite(vinMin))
    errors.push(err('vinMin', 'Vin_min must be a positive number.'))
  if (!isPositiveFinite(vinMax))
    errors.push(err('vinMax', 'Vin_max must be a positive number.'))
  if (isPositiveFinite(vinMin) && isPositiveFinite(vinMax) && vinMax < vinMin)
    errors.push(err('vinMax', 'Vin_max must be ≥ Vin_min.'))

  return errors
}

/**
 * Checks that Vout satisfies the topology's step-up / step-down / polarity rules.
 *
 * - Buck: Vout < Vin_min (step-down only)
 * - Boost: Vout > Vin_max (step-up only)
 * - Buck-boost: Vout must be entered as a negative value
 */
function validateOutputVoltage(topology: TopologyId, spec: DesignSpec): ValidationError[] {
  const { vinMin, vinMax, vout } = spec
  const voutMag = Math.abs(vout)
  const errors: ValidationError[] = []

  if (!isPositiveFinite(voutMag))
    errors.push(err('vout', 'Vout magnitude must be positive.'))

  if (topology === 'buck' && Number.isFinite(vout) && isPositiveFinite(vinMin) && vout >= vinMin)
    errors.push(err('vout',
      `Buck output (${vout} V) must be less than Vin_min (${vinMin} V). Buck is a step-down converter.`))

  if (topology === 'boost' && Number.isFinite(vout) && isPositiveFinite(vinMax) && vout <= vinMax)
    errors.push(err('vout',
      `Boost output (${vout} V) must exceed Vin_max (${vinMax} V). Boost is a step-up converter.`))

  if (topology === 'buck-boost' && Number.isFinite(vout) && vout > 0)
    errors.push(err('vout',
      'Enter Vout as a negative value for buck-boost (e.g. −5 V for a −5 V rail).', 'warning'))

  return errors
}

/**
 * Warns when the estimated duty cycle approaches topology-specific limits.
 *
 * - Flyback: approximate D = |Vout| / (Vin_min + |Vout|); warn above 50 %
 *   (off-line designs risk volt-second runaway above this threshold).
 * - Forward: approximate D = Vout / Vin_min; warn above 45 %
 *   (reset winding constrains the maximum duty cycle).
 */
function validateDutyCycle(topology: TopologyId, spec: DesignSpec): ValidationError[] {
  const { vinMin, vout } = spec
  const voutMag = Math.abs(vout)

  if (topology === 'flyback' && isPositiveFinite(vinMin) && isPositiveFinite(voutMag)) {
    const d = voutMag / (vinMin + voutMag)
    if (d > 0.5)
      return [err('vout',
        `Estimated duty cycle ≈ ${(d * 100).toFixed(0)} % exceeds 50 %. ` +
        'Off-line flyback designs typically stay below D = 50 % to avoid runaway.', 'warning')]
  }

  if (topology === 'forward' && isPositiveFinite(vinMin) && isPositiveFinite(vout)) {
    const d = vout / vinMin
    if (d > 0.45)
      return [err('vout',
        `Estimated duty cycle ≈ ${(d * 100).toFixed(0)} % exceeds 45 %. ` +
        'The reset winding constrains forward converters to D ≤ 45 %.', 'warning')]
  }

  return []
}

/**
 * Validates the switching frequency.
 *
 * - Below 10 kHz: error — magnetic components become impractically large.
 * - Above 5 MHz: warning — switching losses will dominate efficiency.
 */
function validateFrequency(spec: DesignSpec): ValidationError[] {
  const { fsw } = spec

  if (!isPositiveFinite(fsw))
    return [err('fsw', 'Switching frequency must be a positive number.')]
  if (fsw < 10_000)
    return [err('fsw',
      `Unusually low fsw (${(fsw / 1000).toFixed(0)} kHz). Magnetic components will be very large.`, 'warning')]
  if (fsw > 5_000_000)
    return [err('fsw',
      `Extremely high fsw (${(fsw / 1e6).toFixed(1)} MHz). Switching losses will dominate efficiency.`, 'warning')]

  return []
}

/**
 * Validates the inductor ripple ratio and the output ripple voltage budget.
 *
 * - Ripple ratio < 0.05 → inductor becomes impractically large.
 * - Ripple ratio > 0.8 → high peak current; likely discontinuous conduction mode.
 * - Output ripple budget > 10 % of Vout → exceeds typical datasheet limits.
 */
function validateRipple(spec: DesignSpec): ValidationError[] {
  const { rippleRatio, voutRippleMax, vout } = spec
  const voutMag = Math.abs(vout)
  const errors: ValidationError[] = []

  if (!Number.isFinite(rippleRatio))
    errors.push(err('rippleRatio', 'Ripple ratio must be a number.'))
  else if (rippleRatio < 0.05)
    errors.push(err('rippleRatio',
      `Ripple ratio ${rippleRatio.toFixed(3)} < 0.05 requires an impractically large inductor.`))
  else if (rippleRatio > 0.8)
    errors.push(err('rippleRatio',
      `Ripple ratio ${rippleRatio.toFixed(2)} > 0.8 causes very high peak current and likely DCM.`))

  if (!isPositiveFinite(voutRippleMax))
    errors.push(err('voutRippleMax', 'Output ripple budget must be a positive number.'))
  else if (isPositiveFinite(voutMag) && voutRippleMax > voutMag * 0.1)
    errors.push(err('voutRippleMax',
      `Ripple budget (${(voutRippleMax * 1000).toFixed(0)} mV) exceeds 10 % of Vout ` +
      `(limit: ${(voutMag * 100).toFixed(0)} mV).`))

  return errors
}

/**
 * Validates the output current.
 * Warns when load is below 10 mA because CCM equations assume continuous conduction.
 */
function validateLoad(spec: DesignSpec): ValidationError[] {
  const { iout } = spec

  if (!isPositiveFinite(iout))
    return [err('iout', 'Iout must be a positive number.')]
  if (iout < 0.01)
    return [err('iout',
      'Very light load (< 10 mA). The converter will likely operate in DCM; CCM equations may be inaccurate.',
      'warning')]

  return []
}

/**
 * Validates flyback secondary output definitions.
 *
 * - Maximum 3 additional windings (4 total outputs).
 * - Each winding requires positive Vout, positive Iout, and non-negative diode Vf.
 * - Warns when a secondary Vout exceeds 2 × Vin_min (impractical turns ratio).
 */
function validateSecondaryOutputs(spec: DesignSpec): ValidationError[] {
  const secondaries = spec.secondary_outputs
  if (!secondaries?.length) return []

  const { vinMin } = spec
  const errors: ValidationError[] = []

  if (secondaries.length > 3)
    errors.push(err('secondary_outputs', 'Maximum 3 additional secondary outputs (4 total windings).'))

  secondaries.forEach((s, i) => {
    const tag = `secondary_outputs[${i}]`
    const label = `Output ${i + 2}`

    if (!isPositiveFinite(s.vout))
      errors.push(err(tag, `${label}: Vout must be a positive number.`))
    if (!isPositiveFinite(s.iout))
      errors.push(err(tag, `${label}: Iout must be a positive number.`))
    if (!Number.isFinite(s.diode_vf) || s.diode_vf < 0)
      errors.push(err(tag, `${label}: Diode Vf must be ≥ 0.`))
    if (isPositiveFinite(s.vout) && isPositiveFinite(vinMin) && s.vout > vinMin * 2)
      errors.push(err(tag,
        `${label}: Vout (${s.vout} V) is more than 2× Vin_min. ` +
        'Check turns ratio — large secondary voltages may be impractical.', 'warning'))
  })

  return errors
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validates a `DesignSpec` against topology-specific electrical constraints.
 *
 * Collects results from each section validator and merges them into a single
 * `ValidationResult`. Errors with `severity === 'error'` block worker dispatch;
 * `'warning'` entries are advisory and allow computation to continue.
 *
 * @param topology - The active topology ID (e.g. `'buck'`, `'flyback'`).
 * @param spec     - The current design specification from the store.
 */
export function validateSpec(topology: TopologyId, spec: DesignSpec): ValidationResult {
  const errors: ValidationError[] = [
    ...validateInputVoltages(spec),
    ...validateOutputVoltage(topology, spec),
    ...validateDutyCycle(topology, spec),
    ...validateFrequency(spec),
    ...validateRipple(spec),
    ...validateLoad(spec),
    ...(topology === 'flyback' ? validateSecondaryOutputs(spec) : []),
  ]

  return { valid: errors.every(e => e.severity !== 'error'), errors }
}
