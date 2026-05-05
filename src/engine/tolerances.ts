// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// mulberry32 — fast, seedable PRNG suitable for reproducible Monte Carlo runs.
// Reference: bryc/code jshash/PRNGs.md
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ToleranceModel {
  sample(nominal: number, rng: () => number): number
}

// Box-Muller transform — consumes two RNG draws per call.
function sampleNormal(mean: number, std: number, rng: () => number): number {
  const u1 = Math.max(rng(), 1e-15) // guard against log(0)
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + std * z
}

/** Returns nominal unchanged — use for zero-tolerance baseline runs. */
export const noTolerance: ToleranceModel = {
  sample(nominal) { return nominal },
}

/** Inductance: ±20 % uniform — covers class-2 ceramic and wound inductors. */
export const InductorTolerance: ToleranceModel = {
  sample(nominal, rng) { return nominal * (0.8 + rng() * 0.4) },
}

/** DCR: +0 / +50 % uniform — accounts for wire resistance spread and self-heating. */
export const InductorDCRTolerance: ToleranceModel = {
  sample(nominal, rng) { return nominal * (1.0 + rng() * 0.5) },
}

/** Ceramic capacitance: ±10 % uniform — X5R / X7R class-2 tolerance band. */
export const CeramicCapTolerance: ToleranceModel = {
  sample(nominal, rng) { return nominal * (0.9 + rng() * 0.2) },
}

/** Electrolytic / polymer ESR: +0 / +200 % uniform — accounts for ageing and temperature. */
export const ElectrolyticCapTolerance: ToleranceModel = {
  sample(nominal, rng) { return nominal * (1.0 + rng() * 2.0) },
}

/** MOSFET Rds_on: ×uniform(1.0, 2.0) — models temperature derating from 25 °C to 150 °C. */
export const MosfetRdsOnTolerance: ToleranceModel = {
  sample(nominal, rng) { return nominal * (1.0 + rng()) },
}

/** MOSFET Qg: ±15 % uniform — gate charge spread across process corners. */
export const MosfetQgTolerance: ToleranceModel = {
  sample(nominal, rng) { return nominal * (0.85 + rng() * 0.30) },
}

/** Diode Vf: normal with σ = 50 mV — forward-voltage process variation. */
export const DiodeVfTolerance: ToleranceModel = {
  sample(nominal, rng) { return sampleNormal(nominal, 0.050, rng) },
}

/** Inductor Isat: ±10 % uniform — datasheet spread plus temperature derating. */
export const InductorIsatTolerance: ToleranceModel = {
  sample(nominal, rng) { return nominal * (0.90 + rng() * 0.20) },
}
