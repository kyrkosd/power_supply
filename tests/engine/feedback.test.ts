// Feedback network calculator tests
// Reference: TI SLVA477B eq. 3 — Vout = Vref × (1 + Rtop / Rbot)
//
// Test case A — E96, Vout=5 V, Vref=0.8 V, Idiv=100 µA:
//   R_bot_ideal = 0.8 / 100e-6 = 8000 Ω
//   R_top_ideal = 8000 × (5.0/0.8 − 1) = 8000 × 5.25 = 42000 Ω
//   E96 snap for 8000 Ω: neighbours 7870 (Δ130) and 8060 (Δ60) → 8060 Ω
//   E96 snap for 42000 Ω: neighbours 41200 (Δ800) and 42200 (Δ200) → 42200 Ω
//   actual_Vout = 0.8 × (1 + 42200/8060) = 0.8 × 6.23573... = 4.98858... V
//   error = (4.98858 − 5.0)/5.0 × 100 = −0.2284 %
//   divider_current = 0.8/8060 = 99.255... µA
//   power = 4.98858 × 99.255e-6 = 495.2... µW
//
// Test case B — E96, Vout=3.3 V, Vref=0.8 V, Idiv=100 µA:
//   R_bot_ideal = 8000 Ω → E96 snap → 8060 Ω
//   R_top_ideal = 8000 × (3.3/0.8 − 1) = 8000 × 3.125 = 25000 Ω
//   E96 snap for 25000 Ω: neighbours 24900 (Δ100) and 25500 (Δ500) → 24900 Ω
//   actual_Vout = 0.8 × (1 + 24900/8060) = 0.8 × 4.08931... = 3.27145... V
//   error = (3.27145 − 3.3)/3.3 × 100 = −0.865 %
//
// Test case C — E24, Vout=5 V, Vref=0.8 V, Idiv=100 µA:
//   R_bot_ideal = 8000 Ω; E24 nearest: 7500 (Δ500) and 8200 (Δ200) → 8200 Ω
//   R_top_ideal = 42000 Ω; E24 in 10k decade: 39000 (Δ3000) and 43000 (Δ1000) → 43000 Ω
//   actual_Vout = 0.8 × (1 + 43000/8200) = 0.8 × 6.2439... = 4.9951... V
//   error = (4.9951 − 5.0)/5.0 × 100 = −0.0976 %
//
// Test case D — custom Vref=1.25 V, Idiv=50 µA, Vout=12 V:
//   R_bot_ideal = 1.25/50e-6 = 25000 Ω → E96 snap: 24900 Ω
//   R_top_ideal = 25000 × (12/1.25 − 1) = 25000 × 8.6 = 215000 Ω
//   E96 snap for 215000 Ω: in 100k decade, 215000 exact → 215000 Ω
//   actual_Vout = 1.25 × (1 + 215000/24900) = 1.25 × 9.6386... = 12.0482... V
//   error = (12.0482 − 12)/12 × 100 = +0.4018 %

import { describe, it, expect } from 'vitest'
import { designFeedback } from '../../src/engine/feedback'

describe('designFeedback', () => {
  it('test A — E96, 5 V output, 0.8 V reference, 100 µA', () => {
    const r = designFeedback(5.0, { vref: 0.8, divider_current_ua: 100, prefer_e24: false })

    expect(r.r_bottom).toBe(8060)
    expect(r.r_top).toBe(42200)
    expect(r.e96_values_used).toBe(true)
    expect(r.vref).toBe(0.8)

    // actual_Vout = 0.8 × (1 + 42200/8060)
    expect(r.actual_vout).toBeCloseTo(4.98858, 3)

    // error ≈ −0.228 %
    expect(r.vout_error_pct).toBeCloseTo(-0.2284, 2)

    // divider current = 0.8 / 8060 ≈ 99.26 µA
    expect(r.divider_current * 1e6).toBeCloseTo(99.255, 1)

    // power = 4.98858 × 99.26e-6 ≈ 495 µW
    expect(r.power_dissipated * 1e6).toBeCloseTo(495.2, 0)
  })

  it('test B — E96, 3.3 V output — snap selects nearest lower value', () => {
    const r = designFeedback(3.3, { vref: 0.8, divider_current_ua: 100, prefer_e24: false })

    expect(r.r_bottom).toBe(8060)
    // R_top_ideal = 25000 → nearest E96 is 24900
    expect(r.r_top).toBe(24900)

    // actual_Vout = 0.8 × (1 + 24900/8060) = 0.8 × 4.08931... = 3.27145... V
    expect(r.actual_vout).toBeCloseTo(3.2715, 3)

    // error ≈ −0.865 %
    expect(r.vout_error_pct).toBeCloseTo(-0.865, 1)
  })

  it('test C — E24, 5 V output — coarser snap, still < 1% error', () => {
    const r = designFeedback(5.0, { vref: 0.8, divider_current_ua: 100, prefer_e24: true })

    expect(r.e96_values_used).toBe(false)
    expect(r.r_bottom).toBe(8200)
    expect(r.r_top).toBe(43000)

    // actual_Vout = 0.8 × (1 + 43000/8200) ≈ 4.9951 V
    expect(r.actual_vout).toBeCloseTo(4.9951, 3)
    expect(r.vout_error_pct).toBeCloseTo(-0.0976, 2)
  })

  it('test D — custom Vref=1.25 V, 12 V output, 50 µA — 215 kΩ exact E96 match', () => {
    const r = designFeedback(12.0, { vref: 1.25, divider_current_ua: 50, prefer_e24: false })

    expect(r.r_bottom).toBe(24900)
    expect(r.r_top).toBe(215000)

    // actual_Vout = 1.25 × (1 + 215000/24900) ≈ 12.048 V
    expect(r.actual_vout).toBeCloseTo(12.048, 2)
    expect(r.vout_error_pct).toBeCloseTo(0.402, 1)
  })

  it('uses DEFAULT_FEEDBACK_OPTIONS when no options provided', () => {
    const r = designFeedback(5.0)

    // Defaults: vref=0.8V, Idiv=100µA, E96
    expect(r.vref).toBe(0.8)
    expect(r.e96_values_used).toBe(true)
    // same as test A
    expect(r.r_bottom).toBe(8060)
    expect(r.r_top).toBe(42200)
  })

  it('clamps R_top to minimum E96 value when Vout ≤ Vref', () => {
    // Vout = 0.5 V < Vref = 0.8 V → R_top_ideal < 0, clamp to series minimum
    const r = designFeedback(0.5, { vref: 0.8 })
    expect(r.r_top).toBe(10)  // minimum E96 value in dataset
    expect(r.r_bottom).toBeGreaterThan(0)
  })

  it('handles high-impedance divider (large Idiv denominator)', () => {
    // 10 µA divider → R_bot ≈ 80 kΩ, R_top ≈ 420 kΩ
    const r = designFeedback(5.0, { vref: 0.8, divider_current_ua: 10, prefer_e24: false })
    expect(r.r_bottom).toBeGreaterThan(70000)
    expect(r.r_top).toBeGreaterThan(400000)
    expect(Math.abs(r.vout_error_pct)).toBeLessThan(2.0)
  })
})
