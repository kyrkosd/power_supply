// ── Magnetics formula helpers ─────────────────────────────────────────────────

// Erickson & Maksimovic eq. 13.6 — limits to 0.45 for safe operating margin
export function computeDutyCycle(vinNom: number, vout: number): number {
  return Math.min(0.45, vout / (vinNom + vout))
}

// Turns ratio Np/Ns from volt-seconds balance at nominal operating point.
// Mohan, Undeland, Robbins "Power Electronics" 3rd ed., eq. 10.3
export function computeTurnsRatio(vinNom: number, D: number, vout: number): number {
  return (vinNom * D) / vout
}

// TI SLUA117B eq. 3 — minimum magnetizing inductance for CCM boundary
export function computeMagnetizingInductance(vinMin: number, D: number, pTotal: number, fsw: number): number {
  return (vinMin * D) ** 2 / (2 * pTotal * fsw)
}

// Ns_k = Np × (Vout_k + Vf_k) / (Vin_nom × D)
// Mohan, Undeland, Robbins 3rd ed., eq. 10.3
export function computeSecondaryTurns(Np: number, D: number, vinNom: number, vout_k: number, vf_k: number): number {
  return Math.ceil(Np * (vout_k + vf_k) / (vinNom * D))
}

// Kazimierczuk "High-Frequency Magnetic Components" 2nd ed., eq. 3.12
export function computeDiodeVr(ns: number, np: number, vinMax: number, vout_k: number): number {
  return vout_k + (ns / np) * vinMax
}

// Cout_k ≥ Iout_k × D / (fsw × ΔVout_k) with 2 % ripple budget
export function computeSecondaryCapacitance(iout_k: number, D: number, fsw: number, vout_k: number): number {
  return (iout_k * D) / (fsw * vout_k * 0.02)
}

// Cross-regulation estimate under ±50 % primary load variation.
// Mohan, Undeland, Robbins 3rd ed., Fig. 10-8
export function estimateCrossRegPct(ns: number, np: number, vinNom: number, D: number, vout_k: number): number {
  return ((ns / np) * vinNom * (D * 0.12) / vout_k) * 100
}
