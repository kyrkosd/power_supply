import type { DesignSpec, DesignResult } from '../types'

export interface EquationVar {
  key: string
  symbol: string
  label: string
  displayUnit: string
  displayScale: number
  min: number
  max: number
  step: number
  extract: (spec: DesignSpec, result: DesignResult | null) => number
}

export interface EquationEntry {
  id: string
  label: string
  symbol: string
  displayUnit: string
  displayScale: number
  formula: string
  substituted: (vars: Record<string, number>, resultSI: number) => string
  evaluate: (vars: Record<string, number>) => number
  variables: EquationVar[]
  description: string
  source_ref: string
  extract: (spec: DesignSpec, result: DesignResult | null) => number | null
}

export function numSuffix(x: number, decimals = 2): string {
  if (Math.abs(x) >= 1e6) return `${(x / 1e6).toFixed(decimals)}M`
  if (Math.abs(x) >= 1e3) return `${(x / 1e3).toFixed(0)}k`
  return x.toFixed(decimals)
}
