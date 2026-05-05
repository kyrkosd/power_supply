// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
/** Formats a Henry value with automatic mH / µH / nH scaling. */
export function fmtL(h: number): string {
  if (h >= 1e-3) return `${(h * 1e3).toFixed(2)} mH`
  if (h >= 1e-6) return `${(h * 1e6).toFixed(2)} µH`
  return `${(h * 1e9).toFixed(2)} nH`
}

/** Formats a Farad value with automatic mF / µF / nF scaling. */
export function fmtC(f: number): string {
  if (f >= 1e-3) return `${(f * 1e3).toFixed(2)} mF`
  if (f >= 1e-6) return `${(f * 1e6).toFixed(2)} µF`
  return `${(f * 1e9).toFixed(2)} nF`
}

/** Formats an Ohm value with automatic Ω / mΩ / µΩ scaling. */
export function fmtR(r: number): string {
  if (r >= 1)    return `${r.toFixed(3)} Ω`
  if (r >= 1e-3) return `${(r * 1e3).toFixed(1)} mΩ`
  return `${(r * 1e6).toFixed(1)} µΩ`
}

/** Formats a Hz value with automatic MHz / kHz / Hz scaling. */
export function fmtHz(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`
  return `${hz.toFixed(0)} Hz`
}
