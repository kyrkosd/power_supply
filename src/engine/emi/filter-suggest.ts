// Balanced LC DM filter sizing with 6 dB safety margin; characteristic impedance ~10 Ω.
export function suggestDmFilter(worst_margin_db: number, first_failing_harmonic: number): { Lf_uH: number; Cf_uF: number } {
  const req_atten_db = Math.abs(worst_margin_db) + 6
  const atten_lin = Math.pow(10, req_atten_db / 20)
  const fc = Math.min(first_failing_harmonic / 3, first_failing_harmonic / Math.sqrt(atten_lin))
  const Cf = 1 / (2 * Math.PI * fc * Math.sqrt(10))
  return { Lf_uH: 10 * Cf * 1e6, Cf_uF: Cf * 1e6 }
}
