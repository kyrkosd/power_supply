// Distribution statistics: histogram, mean, std, percentiles.

export interface MCDistribution {
  values: number[]
  mean: number
  std: number
  min: number
  max: number
  p5: number
  p95: number
  histogram: Array<{ bin_center: number; count: number }>
}

function buildHistogram(values: number[], bins: number): Array<{ bin_center: number; count: number }> {
  if (values.length === 0) return Array.from({ length: bins }, (_, i) => ({ bin_center: i, count: 0 }))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const width = (hi - lo || 1) / bins
  const hist = Array.from({ length: bins }, (_, i) => ({ bin_center: lo + (i + 0.5) * width, count: 0 }))
  for (const v of values) {
    hist[Math.min(Math.floor((v - lo) / width), bins - 1)].count++
  }
  return hist
}

const EMPTY: MCDistribution = { values: [], mean: NaN, std: NaN, min: NaN, max: NaN, p5: NaN, p95: NaN, histogram: [] }

export function computeDistribution(values: number[]): MCDistribution {
  const n = values.length
  if (n === 0) return { ...EMPTY }
  const sorted = [...values].sort((a, b) => a - b)
  const mean   = values.reduce((s, v) => s + v, 0) / n
  const std    = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  return {
    values,
    mean, std,
    min: sorted[0],
    max: sorted[n - 1],
    p5:  sorted[Math.floor(0.05 * (n - 1))],
    p95: sorted[Math.floor(0.95 * (n - 1))],
    histogram: buildHistogram(values, 20),
  }
}
