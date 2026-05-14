import type { DesignSpec } from '../types'
import type { TopologyId } from '../../store/workbenchStore'
import { type ValidationError, isPositiveFinite, err } from './types'

export function validateInputVoltages(spec: DesignSpec): ValidationError[] {
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

export function validateOutputVoltage(topology: TopologyId, spec: DesignSpec): ValidationError[] {
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

// Warns when the estimated duty cycle approaches topology-specific limits.
export function validateDutyCycle(topology: TopologyId, spec: DesignSpec): ValidationError[] {
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
