// Group ValidationError[] into a per-field map for O(1) lookup during render.
import { useMemo } from 'react'
import type { ValidationError } from '../../engine/validation'

export function useFieldErrors(errors: ValidationError[]): Map<string, ValidationError[]> {
  return useMemo(() => {
    const map = new Map<string, ValidationError[]>()
    for (const e of errors) {
      const list = map.get(e.field) ?? []
      list.push(e)
      map.set(e.field, list)
    }
    return map
  }, [errors])
}
