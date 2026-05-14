// References:
//   TI SLVA477B eq. 3 — Vout = Vref × (1 + R_top / R_bottom)
//   IEC 60063:2015    — preferred number series E24, E96
//   Analog Devices MT-088 — resistor selection for precision dividers
export type { FeedbackOptions, FeedbackResult } from './feedback/types'
import type { FeedbackOptions, FeedbackResult } from './feedback/types'
import { computeDesign } from './feedback/design'

export const DEFAULT_FEEDBACK_OPTIONS: FeedbackOptions = {
  vref: 0.8,
  divider_current_ua: 100,
  prefer_e24: false,
}

export function fmtResistor(ohm: number): string {
  if (ohm >= 1_000_000) return `${(ohm / 1_000_000).toPrecision(3)} MΩ`
  if (ohm >= 1_000)     return `${(ohm / 1_000).toPrecision(3)} kΩ`
  return `${ohm.toPrecision(3)} Ω`
}

export function designFeedback(vout: number, options: Partial<FeedbackOptions> = {}): FeedbackResult {
  return computeDesign(vout, { ...DEFAULT_FEEDBACK_OPTIONS, ...options })
}
