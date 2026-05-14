// Trapezoidal switching current spectrum. Erickson & Maksimovic §18.
export interface EMIDesignResult {
  dutyCycle?: number
  duty_cycle?: number
  peakCurrent?: number
  inductor?: { peak_current: number }
}

// dBµV amplitude of the n-th harmonic across a 50 Ω LISN; +6 dB broadband CM estimate.
export function harmonicAmplitude_dbuv(n: number, fsw: number, D: number, tr: number, Ipeak: number): number {
  const x2 = n * Math.PI * D
  const x3 = n * Math.PI * tr * fsw
  const term2 = x2 === 0 ? 1 : Math.abs(Math.sin(x2) / x2)
  const term3 = x3 === 0 ? 1 : Math.abs(Math.sin(x3) / x3)
  const In = (2 * Ipeak * D) / (n * Math.PI) * term2 * term3
  return 20 * Math.log10(In * 50 * 1e6) + 6
}
