import type { DesignSpec } from './types'
import type { TopologyId } from '../store/workbenchStore'
import type { ValidationResult } from './validation/types'
import { validateInputVoltages, validateOutputVoltage, validateDutyCycle } from './validation/voltages'
import { validateFrequency, validateRipple, validateLoad } from './validation/electrical'
import { validateSecondaryOutputs } from './validation/secondaries'

export type { ValidationError, ValidationResult } from './validation/types'

export function validateSpec(topology: TopologyId, spec: DesignSpec): ValidationResult {
  const errors = [
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
