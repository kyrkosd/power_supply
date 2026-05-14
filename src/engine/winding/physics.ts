// Skin depth, Dowell proximity-loss factor, and leakage-inductance estimate.
// References: Dowell (1966) IEE Proc. 113(8); Kazimierczuk eq. 4.60, 4.70, 6.28.

const MU0 = 4 * Math.PI * 1e-7  // H/m

/** Kazimierczuk eq. 4.60: δ = 66.2 / √fsw mm, copper at 20 °C. */
export function skinDepthMm(fsw: number): number {
  return 66.2 / Math.sqrt(fsw)
}

/**
 * Dowell (1966) eq. 11 with circular-wire correction (Kazimierczuk eq. 4.70).
 * Returns max(1, Fr) — AC losses can only increase Rac.
 */
export function dowellFr(layers: number, strandDiam_mm: number, delta_mm: number): number {
  const eta = (strandDiam_mm / delta_mm) * Math.sqrt(Math.PI / 4)
  if (eta < 0.01) return 1
  const sinh2 = Math.sinh(2 * eta), cosh2 = Math.cosh(2 * eta)
  const sin2  = Math.sin(2 * eta),  cos2  = Math.cos(2 * eta)
  const sinhE = Math.sinh(eta), coshE = Math.cosh(eta)
  const sinE  = Math.sin(eta),  cosE  = Math.cos(eta)
  const term1 = eta * (sinh2 + sin2) / (cosh2 - cos2)
  const term2 = (2 * (layers ** 2 - 1) / 3) * eta * (sinhE - sinE) / (coshE + cosE)
  return Math.max(1, term1 + term2)
}

/**
 * Kazimierczuk eq. 6.28: Llk = μ₀ × Np² × MLT × (b_ins/3) / bw.
 * Interleaved P–S–P winding reduces Llk ~4×.
 */
export function leakageNh(Np: number, MLT_m: number, bw_m: number, b_ins_m: number, interleaved: boolean): number {
  const Llk = MU0 * Np ** 2 * MLT_m * (b_ins_m / 3) / bw_m
  return (interleaved ? Llk / 4 : Llk) * 1e9
}
