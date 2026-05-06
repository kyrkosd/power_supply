// Soft-start / inrush estimation tests
// Reference: TI SLVA801, Erickson & Maksimovic §10.1, ON Semiconductor AND9135
//
// Test A — Buck, auto tss, known DCR:
//   Spec: vinMax=15 V, vout=5 V, iout=2 A, fsw=200 kHz
//   Result: capacitance=47 µF, inductance=10 µH
//   Inductor: dcr_mohm=50
//
//   recommended_tss = Cout × Vout × 10 / Iout
//                   = 47e-6 × 5 × 10 / 2 = 1.175 ms → clamp(1 ms, 50 ms) = 1.175 ms
//
//   css = Iss × tss / Vref = 10e-6 × 1.175e-3 / 0.8 = 14.6875 nF
//
//   peak_inrush_a = Vin_max / DCR = 15 / 0.050 = 300 A
//
//   peak_inrush_with_ss = Cout × Vout / tss + Iout
//                       = 47e-6 × 5 / 1.175e-3 + 2
//                       = 0.200 + 2 = 2.200 A
//
//   fc_est = 200 000 / 10 = 20 000 Hz
//   output_monotonic = (fc_est > 1/tss) = (20 000 > 1/0.001175) = (20 000 > 851) = true
//
//   pre_bias_safe = true (buck — non-isolated)
//
// Test B — Manual tss = 5 ms:
//   tss_used = 5 ms (overrides recommended 1.175 ms)
//   css = 10e-6 × 5e-3 / 0.8 = 62.5 nF
//   peak_inrush_with_ss = 47e-6 × 5 / 5e-3 + 2 = 0.047 + 2 = 2.047 A
//
// Test C — Flyback → pre_bias_safe = false, warning fired
//
// Test D — Small Cout → recommended tss < 1 ms → clamped to 1 ms
//   Cout=1 µF, Vout=5 V, Iout=2 A → raw = 1e-6 × 5 × 10 / 2 = 25 µs → clamp → 1 ms
//
// Test E — Very low fsw → output_monotonic = false
//   fsw=5 kHz → fc_est = 500 Hz; tss = 1.175 ms → 1/tss = 851 Hz
//   500 < 851 → output_monotonic = false

import { describe, it, expect } from 'vitest'
import { designSoftStart } from '../../src/engine/soft-start'
import type { DesignSpec, DesignResult } from '../../src/engine/types'
import type { InductorData } from '../../src/engine/component-selector'

const BASE_SPEC: DesignSpec = {
  vinMin: 10,
  vinMax: 15,
  vout: 5,
  iout: 2,
  fsw: 200_000,
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.05,
  efficiency: 0.9,
}

const BASE_RESULT: DesignResult = {
  dutyCycle: 0.333,
  inductance: 10e-6,
  capacitance: 47e-6,
  peakCurrent: 2.3,
  warnings: [],
}

const BASE_INDUCTOR: InductorData = {
  manufacturer: 'Test',
  part_number: 'L-TEST',
  inductance_uh: 10,
  dcr_mohm: 50,
  isat_a: 5,
  irms_a: 3,
  size_mm: '5x5',
  core_material: 'ferrite',
}

describe('designSoftStart', () => {
  it('test A — auto tss, known DCR, buck topology', () => {
    const r = designSoftStart('buck', BASE_SPEC, BASE_RESULT, BASE_INDUCTOR)

    // recommended_tss = 47e-6 × 5 × 10 / 2 = 1.175 ms
    expect(r.recommended_tss).toBeCloseTo(0.001175, 6)
    expect(r.tss_used).toBeCloseTo(0.001175, 6)

    // css = 10e-6 × 0.001175 / 0.8 = 14.6875 nF
    expect(r.css * 1e9).toBeCloseTo(14.6875, 3)

    // peak inrush = 15 / 0.050 = 300 A
    expect(r.peak_inrush_a).toBeCloseTo(300, 1)

    // inrush with SS = 47e-6 × 5 / 0.001175 + 2 ≈ 2.200 A
    expect(r.peak_inrush_with_ss).toBeCloseTo(2.200, 2)

    // fc_est=20 000 Hz > 1/0.001175=851 Hz → monotonic
    expect(r.output_monotonic).toBe(true)

    // Non-isolated → pre-bias safe
    expect(r.pre_bias_safe).toBe(true)

    // High inrush warning (300 A >> 10 × 2 = 20 A)
    expect(r.warnings.some(w => w.includes('inrush'))).toBe(true)
  })

  it('test B — manual tss=5 ms overrides recommended', () => {
    const r = designSoftStart('buck', BASE_SPEC, BASE_RESULT, BASE_INDUCTOR, {
      auto_tss: false,
      tss_s: 0.005,
    })

    expect(r.tss_used).toBeCloseTo(0.005, 6)

    // css = 10e-6 × 5e-3 / 0.8 = 62.5 nF
    expect(r.css * 1e9).toBeCloseTo(62.5, 3)

    // inrush with SS = 47e-6 × 5 / 0.005 + 2 = 0.047 + 2 = 2.047 A
    expect(r.peak_inrush_with_ss).toBeCloseTo(2.047, 2)
  })

  it('test C — flyback topology → pre_bias_safe = false', () => {
    const r = designSoftStart('flyback', BASE_SPEC, BASE_RESULT, BASE_INDUCTOR)

    expect(r.pre_bias_safe).toBe(false)
    expect(r.warnings.some(w => w.includes('isolated'))).toBe(true)
  })

  it('test D — small Cout clamps recommended_tss to 1 ms minimum', () => {
    // Cout=1 µF → raw tss = 1e-6 × 5 × 10 / 2 = 25 µs → clamped to 1 ms
    const result: DesignResult = { ...BASE_RESULT, capacitance: 1e-6 }
    const r = designSoftStart('buck', BASE_SPEC, result, BASE_INDUCTOR)

    expect(r.recommended_tss).toBeCloseTo(0.001, 6)
  })

  it('test E — low fsw → output_monotonic = false', () => {
    // fsw=5 kHz → fc_est=500 Hz; tss=1.175 ms → 1/tss=851 Hz; 500 < 851 → not monotonic
    const spec: DesignSpec = { ...BASE_SPEC, fsw: 5_000 }
    const r = designSoftStart('buck', spec, BASE_RESULT, BASE_INDUCTOR)

    expect(r.output_monotonic).toBe(false)
    expect(r.warnings.some(w => w.includes('monotonic'))).toBe(true)
  })

  it('custom iss_ua scales Css proportionally', () => {
    const r1 = designSoftStart('buck', BASE_SPEC, BASE_RESULT, BASE_INDUCTOR, { iss_ua: 10 })
    const r2 = designSoftStart('buck', BASE_SPEC, BASE_RESULT, BASE_INDUCTOR, { iss_ua: 20 })

    // Css ∝ Iss → doubling Iss doubles Css
    expect(r2.css).toBeCloseTo(r1.css * 2, 12)
  })

  it('no inductor → uses heuristic DCR, warns, still computes', () => {
    const r = designSoftStart('buck', BASE_SPEC, BASE_RESULT)

    expect(r.peak_inrush_a).toBeGreaterThan(0)
    expect(r.warnings.some(w => w.includes('DCR estimated'))).toBe(true)
  })
})
