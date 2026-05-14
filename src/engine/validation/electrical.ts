import type { DesignSpec } from '../types'
import { type ValidationError, isPositiveFinite, err } from './types'

export function validateFrequency(spec: DesignSpec): ValidationError[] {
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

export function validateRipple(spec: DesignSpec): ValidationError[] {
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

export function validateLoad(spec: DesignSpec): ValidationError[] {
  const { iout } = spec

  if (!isPositiveFinite(iout))
    return [err('iout', 'Iout must be a positive number.')]
  if (iout < 0.01)
    return [err('iout',
      'Very light load (< 10 mA). The converter will likely operate in DCM; CCM equations may be inaccurate.',
      'warning')]

  return []
}
