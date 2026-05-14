// Generic transfer-function math used by the buck control-loop analyser.
// Pure functions on polynomial coefficient arrays and Bode-point arrays.

import { complex, abs, arg, add, multiply, divide, type Complex } from 'mathjs'

export interface BodePoint {
  freq_hz: number
  magnitude_db: number
  phase_deg: number
}

const RAD_TO_DEG = 180 / Math.PI

function evaluatePolynomial(coeffs: readonly number[], s: ReturnType<typeof complex>) {
  return coeffs.reduce(
    (acc, coeff) => add(multiply(acc, s), coeff) as ReturnType<typeof complex>,
    complex(0, 0),
  )
}

export function evaluateTransferFunction(numerator: readonly number[], denominator: readonly number[], freq_hz: number) {
  const s   = complex(0, 2 * Math.PI * freq_hz)
  const num = evaluatePolynomial(numerator, s)
  const den = evaluatePolynomial(denominator, s)
  const h   = divide(num, den)
  return {
    magnitude_db: 20 * Math.log10(abs(h as Complex)),
    phase_deg:    arg(h as Complex) * RAD_TO_DEG,
  }
}

export function logspace(start: number, stop: number, count: number): number[] {
  const logStart = Math.log10(start)
  const logStop  = Math.log10(stop)
  const step     = (logStop - logStart) / (count - 1)
  return Array.from({ length: count }, (_, i) => 10 ** (logStart + step * i))
}

function interpolate(x0: number, y0: number, x1: number, y1: number, x: number): number {
  if (x1 === x0) return y0
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

export function normalizePhase(phase: number): number {
  return (((phase + 180) % 360 + 360) % 360) - 180
}

function pushExactZero(crossings: Array<{ freq: number; phase: number }>, point: BodePoint, mag: number): void {
  if (mag === 0) crossings.push({ freq: point.freq_hz, phase: point.phase_deg })
}

/** Magnitude crosses zero (in either direction). Returns the closest crossing to `preferredFreq`. */
export function findCrossoverPoint(loop: BodePoint[], preferredFreq?: number): { freq: number; phase: number } | null {
  const crossings: Array<{ freq: number; phase: number }> = []
  for (let i = 1; i < loop.length; i += 1) {
    const before = loop[i - 1].magnitude_db
    const after  = loop[i].magnitude_db
    pushExactZero(crossings, loop[i - 1], before)
    pushExactZero(crossings, loop[i],     after)
    if ((before >= 0 && after <= 0) || (before <= 0 && after >= 0)) {
      const freq  = interpolate(before, loop[i - 1].freq_hz, after, loop[i].freq_hz, 0)
      const phase = interpolate(loop[i - 1].freq_hz, loop[i - 1].phase_deg, loop[i].freq_hz, loop[i].phase_deg, freq)
      crossings.push({ freq, phase })
    }
  }
  if (crossings.length === 0) return null
  if (preferredFreq === undefined) return crossings[0]
  return crossings.reduce((best, current) =>
    Math.abs(current.freq - preferredFreq) < Math.abs(best.freq - preferredFreq) ? current : best,
  )
}

export function findGainMargin(loop: BodePoint[]): { freq: number; magnitude_db: number } | null {
  for (let i = 1; i < loop.length; i += 1) {
    const prevPhase = loop[i - 1].phase_deg
    const nextPhase = loop[i].phase_deg
    if ((prevPhase >= -180 && nextPhase <= -180) || (prevPhase <= -180 && nextPhase >= -180)) {
      const freq = interpolate(loop[i - 1].phase_deg, loop[i - 1].freq_hz, loop[i].phase_deg, loop[i].freq_hz, -180)
      const mag  = interpolate(loop[i - 1].freq_hz, loop[i - 1].magnitude_db, loop[i].freq_hz, loop[i].magnitude_db, freq)
      return { freq, magnitude_db: mag }
    }
  }
  return null
}
