import type { DesignSpec } from '../types'
import { type ValidationError, isPositiveFinite, err } from './types'

export function validateSecondaryOutputs(spec: DesignSpec): ValidationError[] {
  const secondaries = spec.secondary_outputs
  if (!secondaries?.length) return []

  const { vinMin } = spec
  const errors: ValidationError[] = []

  if (secondaries.length > 3)
    errors.push(err('secondary_outputs', 'Maximum 3 additional secondary outputs (4 total windings).'))

  secondaries.forEach((s, i) => {
    const tag   = `secondary_outputs[${i}]`
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
