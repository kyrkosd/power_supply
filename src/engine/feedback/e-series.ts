import e96Data from '../../data/e96-values.json'

export const E96_SERIES = e96Data.e96 as number[]
export const E24_SERIES = e96Data.e24 as number[]

// Binary search nearest neighbour with log-domain tie-break. IEC 60063:2015.
export function snapToSeries(value: number, series: number[]): number {
  if (value <= series[0])                   return series[0]
  if (value >= series[series.length - 1])  return series[series.length - 1]
  let lo = 0, hi = series.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (series[mid] < value) lo = mid + 1
    else hi = mid
  }
  const above = series[lo], below = series[lo - 1]
  return Math.abs(Math.log(value / below)) <= Math.abs(Math.log(above / value)) ? below : above
}
