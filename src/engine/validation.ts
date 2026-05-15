import type { DesignSpec } from './types'
import type { TopologyId } from '../store/workbenchStore'
import type { ValidationResult } from './validation/types'
import { validateInputVoltages, validateOutputVoltage, validateDutyCycle } from './validation/voltages'
import { validateFrequency, validateRipple, validateLoad } from './validation/electrical'
import { validateSecondaryOutputs } from './validation/secondaries'

export type { ValidationError, ValidationResult } from './validation/types'

// Called by: InputPanel and RightPanel components — directly on the renderer thread on every
// spec change, before dispatching to the worker. Returning 'error' severity blocks the worker
// dispatch so computation never runs on an illegal spec (e.g., buck with Vout ≥ Vin). Returning
// 'warning' allows computation but surfaces the issue inline. Not called from the worker itself;
// the topology compute() functions trust that validation has already passed.
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
