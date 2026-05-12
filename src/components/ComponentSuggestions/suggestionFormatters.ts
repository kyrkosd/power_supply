// Pure formatting helpers, colour utilities, and topology constants for ComponentSuggestions.
// No React or DOM imports — safe to call from any context.

/** Topologies whose high-side switch requires a bootstrap gate-drive circuit. */
export const HIGH_SIDE_TOPOLOGIES = new Set(['buck', 'forward'])

/** Non-isolated topologies that support synchronous rectification (sync FET). */
export const NON_ISOLATED = new Set(['buck', 'boost', 'buck-boost', 'sepic'])

/** Isolated topologies that use opto-coupler / TL431 feedback on the secondary. */
export const ISOLATED_TOPOLOGIES = new Set(['flyback', 'forward'])

/** Format a time value in seconds as ns (< 1 µs) or µs. */
export function fmtTime(s: number): string {
  return s < 1e-6 ? `${(s * 1e9).toFixed(1)} ns` : `${(s * 1e6).toFixed(2)} µs`
}

/** Format a capacitance in Farads as nF (< 1 µF) or µF. */
export function fmtCap(f: number): string {
  return f < 1e-6 ? `${(f * 1e9).toFixed(0)} nF` : `${(f * 1e6).toFixed(1)} µF`
}

/** Format a power value in Watts as mW (< 1 W) or W. */
export function fmtPower(w: number): string {
  return w < 1 ? `${(w * 1000).toFixed(1)} mW` : `${w.toFixed(2)} W`
}

/** Format a soft-start duration in seconds as µs (< 1 ms) or ms. */
export function fmtMs(s: number): string {
  return s < 0.001 ? `${(s * 1e6).toFixed(0)} µs` : `${(s * 1e3).toFixed(2)} ms`
}

/** Format a capacitance in Farads with pF / nF / µF auto-scaling (higher resolution). */
export function fmtCap2(f: number): string {
  if (f < 1e-9) return `${(f * 1e12).toFixed(1)} pF`
  if (f < 1e-6) return `${(f * 1e9).toFixed(1)} nF`
  return `${(f * 1e6).toFixed(2)} µF`
}

/** CSS colour string for CCM / boundary / DCM operating mode. */
export function getModeColor(mode?: string): string {
  switch (mode) {
    case 'CCM':      return '#4ade80'
    case 'boundary': return '#fbbf24'
    case 'DCM':      return '#f87171'
    default:         return 'inherit'
  }
}

/** CSS colour for current-sense SNR quality in dB. */
export function snrColor(db: number): string {
  if (db >= 20) return '#4ade80'
  if (db >= 14) return '#f59e0b'
  return '#ef4444'
}

/** CSS colour for Vout regulation error percentage. */
export function errorColor(pct: number): string {
  const abs = Math.abs(pct)
  if (abs < 0.5) return '#4ade80'
  if (abs < 1.0) return '#f59e0b'
  return '#ef4444'
}

/** CSS colour for estimated electrolytic capacitor lifetime in years. */
export function lifetimeColor(years: number): string {
  if (years < 2)  return '#7f1d1d'
  if (years < 5)  return '#ef4444'
  if (years < 10) return '#f59e0b'
  return '#4ade80'
}

/** CSS colour for winding bobbin fill factor percentage. */
export function fillColor(pct: number): string {
  if (pct > 60) return '#ef4444'
  if (pct > 45) return '#f59e0b'
  return '#4ade80'
}

/** CSS colour for Dowell AC proximity-effect factor Fr. */
export function frColor(fr: number): string {
  if (fr > 2)   return '#ef4444'
  if (fr > 1.5) return '#f59e0b'
  return '#4ade80'
}

/**
 * Minimum MOSFET Vds rating required for the topology.
 * Adds 25 % derating margin on top of the worst-case voltage stress.
 */
export function mosfetVdsRequired(topology: string, vinMax: number, vout: number): number {
  switch (topology) {
    case 'boost':      return vout * 1.25
    case 'buck-boost':
    case 'sepic':      return (vinMax + vout) * 1.25
    case 'flyback':
    case 'forward':    return vinMax * 2 * 1.25
    default:           return vinMax * 1.25       // buck
  }
}
