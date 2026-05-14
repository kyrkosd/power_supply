export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]

export function nearestE12(value: number): number {
  if (value <= 0) return E12[0]
  const exp      = Math.floor(Math.log10(value))
  const mantissa = value / Math.pow(10, exp)
  let best = E12[0], bestErr = Math.abs(mantissa - best)
  for (const v of E12) {
    const err = Math.abs(mantissa - v)
    if (err < bestErr) { best = v; bestErr = err }
  }
  return best * Math.pow(10, exp)
}

export function fmtH(h: number): string {
  if (h >= 1e-3) return `${(h * 1e3).toFixed(2)} mH`
  if (h >= 1e-6) return `${(h * 1e6).toFixed(1)} µH`
  return `${(h * 1e9).toFixed(1)} nH`
}

export function fmtF(f: number): string {
  if (f >= 1e-6) return `${(f * 1e6).toFixed(2)} µF`
  if (f >= 1e-9) return `${(f * 1e9).toFixed(1)} nF`
  return `${(f * 1e12).toFixed(1)} pF`
}

export function fmtR(r: number): string {
  if (r >= 1e3) return `${(r / 1e3).toFixed(1)} kΩ`
  return `${r.toFixed(2)} Ω`
}
