// Shared constants for the PDF report: page geometry, palette, and topology labels.

export const PW = 210   // A4 page width  in mm
export const PH = 297   // A4 page height in mm
export const M  = 18    // page margin    in mm
export const CW = PW - 2 * M
export const PAGE_COUNT = 6

export type RGB = readonly [number, number, number]

export const C_HDR:     RGB = [20,  26,  50]
export const C_HDR_TXT: RGB = [155, 175, 205]
export const C_ACCENT:  RGB = [20,  100, 210]
export const C_DARK:    RGB = [28,  34,  55]
export const C_MED:     RGB = [85,  100, 130]
export const C_ROW:     RGB = [244, 246, 252]
export const C_WARN:    RGB = [190, 110, 20]
export const C_OK:      RGB = [40,  140, 75]

// CSS variables → hex values used during SVG serialisation.
export const CSS_VARS: ReadonlyArray<readonly [string, string]> = [
  ['var(--text-primary)',   '#e8eaf0'],
  ['var(--text-secondary)', '#a0b4c8'],
  ['var(--text-muted)',     '#606880'],
  ['var(--accent)',         '#4adcf4'],
  ['var(--surface)',        '#1e2235'],
  ['var(--surface-2)',      '#252a42'],
  ['var(--border)',         '#2a3050'],
  ['var(--bg)',             '#1a1a2e'],
]

const TOPOLOGY_LABELS: Record<string, string> = {
  'buck':       'Buck (Step-Down)',
  'boost':      'Boost (Step-Up)',
  'buck-boost': 'Buck-Boost',
  'flyback':    'Flyback',
  'forward':    'Forward',
  'sepic':      'SEPIC',
}

export function topoLabel(id: string): string {
  return TOPOLOGY_LABELS[id] ?? id.toUpperCase()
}

export function nowStr(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function fmtPct(v: number): string { return `${(v * 100).toFixed(1)} %` }
