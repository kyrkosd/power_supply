export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export function isPositiveFinite(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0
}

export function err(
  field: string,
  message: string,
  severity: ValidationError['severity'] = 'error',
): ValidationError {
  return { field, message, severity }
}
