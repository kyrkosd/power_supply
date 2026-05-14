import type { EquationEntry } from '../../../engine/equation-metadata'

export interface SensitivityResult {
  key:        string
  symbol:     string
  elasticity: number
  description: string
}

function describeElasticity(e: number, elasticity: number): string {
  if (e < 0.1)                  return 'insensitive'
  if (e > 0.9 && e < 1.1)      return elasticity > 0 ? 'directly proportional' : 'inversely proportional'
  if (e > 1.8 && e < 2.2)      return elasticity > 0 ? 'quadratic' : 'inverse square'
  if (e > 0.4 && e < 0.6)      return 'square-root relationship'
  return elasticity > 0
    ? `increases ×${e.toFixed(1)} for each ×2 increase`
    : `decreases ×${e.toFixed(1)} for each ×2 increase`
}

// Central finite differences with ±0.1 % perturbation; sorted by |elasticity| descending.
export function computeSensitivities(entry: EquationEntry, vars: Record<string, number>): SensitivityResult[] {
  const y0 = entry.evaluate(vars)
  if (!Number.isFinite(y0) || Math.abs(y0) < 1e-30) return []

  return entry.variables.map((v) => {
    const eps = 0.001, x0 = vars[v.key]
    if (!Number.isFinite(x0) || Math.abs(x0) < 1e-30)
      return { key: v.key, symbol: v.symbol, elasticity: 0, description: 'constant' }
    const yPlus  = entry.evaluate({ ...vars, [v.key]: x0 * (1 + eps) })
    const yMinus = entry.evaluate({ ...vars, [v.key]: x0 * (1 - eps) })
    const elasticity = ((yPlus - yMinus) / (2 * eps * x0)) * (x0 / y0)
    return { key: v.key, symbol: v.symbol, elasticity, description: describeElasticity(Math.abs(elasticity), elasticity) }
  }).sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity))
}
