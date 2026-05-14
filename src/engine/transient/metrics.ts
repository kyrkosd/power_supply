// Compute settling time (2 % band) and overshoot from the recorded output voltage array.
export function computeTransientMetrics(
  voutArr: Float64Array,
  timeArr: Float64Array,
  vout: number,
): { settling_time_ms: number; overshoot_pct: number } {
  let maxV = 0
  let settledIdx = voutArr.length - 1
  for (let i = 0; i < voutArr.length; i++) if (voutArr[i] > maxV) maxV = voutArr[i]
  for (let i = voutArr.length - 1; i >= 0; i--) {
    if (Math.abs(voutArr[i] - vout) > 0.02 * vout) { settledIdx = i; break }
  }
  return {
    overshoot_pct: Math.max(0, ((maxV - vout) / vout) * 100),
    settling_time_ms: timeArr[settledIdx] * 1000,
  }
}
