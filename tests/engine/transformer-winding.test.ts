// Tests for src/engine/transformer-winding.ts
//
// Reference design (Kazimierczuk "High-Frequency Magnetic Components" 2nd ed., Ch. 4 example):
//   Flyback converter: Vin_min = 10 V, Vout = 5 V, Iout = 5 A, fsw = 100 kHz
//   D = 0.30, Np = 20, Ns = 10, turns ratio N = 2, Ip_peak = 3 A
//   Core: EE25 — MLT = 45 mm, bobbin_width = 17 mm, bobbin_height = 11 mm
//
// Hand calculations:
//   δ = 66.2 / √100 000 = 0.2093 mm  →  2δ = 0.4186 mm
//   Thickest eligible AWG: AWG 26 (diameter = 0.405 mm < 0.4186 mm) ✓
//   AWG 24 (0.511 mm) > 0.4186 mm → excluded
//
//   Primary RMS (triangular CCM):   Ip_rms = 3 × √(0.30/3) = 0.9487 A
//   Primary I/strand at J=4 A/mm²: 0.12885 mm² × 4 = 0.5154 A/strand
//   Primary strands = ceil(0.9487 / 0.5154) = ceil(1.840) = 2
//
//   Secondary peak: Is_peak = 3 / 2 = 1.5 A
//   Secondary RMS:  Is_rms  = 1.5 × √(0.70/3) = 0.7638 A
//   Secondary strands = ceil(0.7638 / 0.5154) = ceil(1.482) = 2
//
//   Primary layers: pitch = 0.405 × 1.10 × √2 = 0.6300 mm
//                   turns/layer = floor(17 / 0.6300) = 26
//                   layers = ceil(20/26) = 1
//
//   Primary R_DC: ρ × MLT × N / A = 1.72e-8 × 0.045 × 20 / (0.12885e-6 × 2)
//               = 1.548e-8 / 2.577e-7 = 0.06007 Ω = 60.07 mΩ
//
//   Dowell Fr (primary, layers=1):
//     η = (0.405/0.2093) × √(π/4) = 1.935 × 0.8862 = 1.7147
//     sinh(2η)=15.52, cosh(2η)=15.55, sin(2η)=−0.3290, cos(2η)=−0.9444
//     A1 = 15.52 − 0.329 = 15.19,  B1 = 15.55 + 0.9444 = 16.49
//     term1 = 1.7147 × 15.19 / 16.49 = 1.580
//     nl=1 → term2 = 0  →  Fr = 1.580
//
//   Leakage (interleaved, b_ins=0.3 mm):
//     Llk = μ₀ × 400 × 0.045 × (0.1e-3) / 0.017 / 4
//         = 4π×10−7 × 400 × 0.045 × (0.1e-3/0.017) / 4
//     non-interleaved = 1.257e-6 × 400 × 0.045 × 5.882e-3 = 1.332e-7 H = 133.2 nH
//     interleaved = 133.2 / 4 = 33.3 nH
//
//   Creepage (working V = 1.5 × 14 = 21 V → ≤ 50 V range): 1.5 mm
//   Clearance: 0.8 mm

import { describe, it, expect } from 'vitest'
import {
  designWinding,
  flybackPrimaryRms,
  flybackSecondaryRms,
  forwardPrimaryRms,
  forwardSecondaryRms,
} from '../../src/engine/transformer-winding'
import type { WindingResult } from '../../src/engine/transformer-winding'
import type { DesignSpec, DesignResult } from '../../src/engine/types'
import type { CoreData } from '../../src/engine/topologies/core-selector'

// ── Shared stubs ──────────────────────────────────────────────────────────────

const spec: DesignSpec = {
  vinMin: 10, vinMax: 14, vout: 5, iout: 5,
  fsw: 100_000,
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.05,
  efficiency: 0.9,
}

const result: DesignResult = {
  dutyCycle: 0.30,
  primaryTurns: 20,
  secondaryTurns: 10,
  turnsRatio: 2,
  peakCurrent: 3,      // A — primary peak
  inductance: 50e-6,   // H — magnetising
  magnetizingInductance: 50e-6,
  capacitance: 100e-6,
  clampVoltage: 21,    // V — 1.5 × vinMax
  efficiency: 0.9,
  warnings: [],
}

// EE25 core — MLT 45 mm, bobbin 17 × 11 mm
const core: CoreData = {
  type: 'EE25',
  Ae: 40e-6, Aw: 28e-6, le: 0.055, Ve: 2.2e-6, AL: 1600,
  MLT_mm: 45,
  bobbin_width_mm: 17,
  bobbin_height_mm: 11,
}

// ── RMS helper tests ──────────────────────────────────────────────────────────

describe('RMS current helpers', () => {
  it('flybackPrimaryRms = Ip × √(D/3)', () => {
    const expected = 3 * Math.sqrt(0.3 / 3)
    expect(flybackPrimaryRms(3, 0.3)).toBeCloseTo(expected, 5)
  })

  it('flybackSecondaryRms = (Ip/N) × √((1−D)/3)', () => {
    const expected = (3 / 2) * Math.sqrt(0.7 / 3)
    expect(flybackSecondaryRms(3, 2, 0.3)).toBeCloseTo(expected, 5)
  })

  it('forwardSecondaryRms = Iout × √D', () => {
    expect(forwardSecondaryRms(5, 0.4)).toBeCloseTo(5 * Math.sqrt(0.4), 5)
  })

  it('forwardPrimaryRms = (Pout/(η×Vin)) × √D', () => {
    const spec2: DesignSpec = { ...spec, fsw: 100_000 }
    const res2: DesignResult = { ...result, efficiency: 0.9 }
    const Ip_avg = (spec2.vout * spec2.iout) / (0.9 * spec2.vinMin)
    const expected = Ip_avg * Math.sqrt(res2.dutyCycle)
    expect(forwardPrimaryRms(spec2, res2)).toBeCloseTo(expected, 5)
  })
})

// ── designWinding — basic structure ──────────────────────────────────────────

describe('designWinding — basic structure', () => {
  const wr: WindingResult = designWinding('flyback', spec, result, core)

  it('returns a WindingResult with correct winding count', () => {
    expect(wr.secondary).toHaveLength(1)
  })

  it('primary has correct turn count', () => {
    expect(wr.primary.turns).toBe(20)
  })

  it('secondary[0] has correct turn count', () => {
    expect(wr.secondary[0].turns).toBe(10)
  })

  it('skin_depth_mm = 66.2 / √fsw (mm)', () => {
    const expected = 66.2 / Math.sqrt(100_000)
    expect(wr.skin_depth_mm).toBeCloseTo(expected, 4)
  })

  it('max_strand_diameter_mm = 2 × skin_depth_mm', () => {
    expect(wr.max_strand_diameter_mm).toBeCloseTo(2 * wr.skin_depth_mm, 5)
  })

  it('winding_order is interleaved P–S–P for single secondary', () => {
    expect(wr.winding_order).toEqual(['Primary (½)', 'Secondary 1', 'Primary (½)'])
  })
})

// ── Wire selection ────────────────────────────────────────────────────────────

describe('wire selection at 100 kHz (δ = 0.2093 mm)', () => {
  const wr: WindingResult = designWinding('flyback', spec, result, core)

  it('primary uses AWG 26 (0.405 mm < 2δ = 0.419 mm)', () => {
    expect(wr.primary.wire_gauge_awg).toBe(26)
  })

  it('secondary uses AWG 26', () => {
    expect(wr.secondary[0].wire_gauge_awg).toBe(26)
  })

  it('primary strands = ceil(Ip_rms / I_per_strand)', () => {
    // Ip_rms = 3 × √(0.3/3) = 0.9487 A; I/strand = 0.12885 × 4 = 0.5154 A
    const Ip_rms = flybackPrimaryRms(3, 0.3)
    const iPerStrand = 0.12885 * 4
    const expected = Math.ceil(Ip_rms / iPerStrand)
    expect(wr.primary.strands).toBe(expected)
  })

  it('primary strands = 2', () => {
    expect(wr.primary.strands).toBe(2)
  })

  it('secondary strands = 2', () => {
    expect(wr.secondary[0].strands).toBe(2)
  })
})

// ── Layer count ───────────────────────────────────────────────────────────────

describe('layer count', () => {
  const wr = designWinding('flyback', spec, result, core)

  it('primary has 1 layer (20 turns fit in 17 mm / 0.63 mm = 27 turns/layer)', () => {
    expect(wr.primary.layers).toBe(1)
  })

  it('secondary has 1 layer (10 turns)', () => {
    expect(wr.secondary[0].layers).toBe(1)
  })
})

// ── Resistance ────────────────────────────────────────────────────────────────

describe('DC resistance', () => {
  const wr = designWinding('flyback', spec, result, core)

  it('primary resistance ≈ 60 mΩ (ρ × MLT × Np / (A × strands))', () => {
    // 1.72e-8 × 0.045 × 20 / (0.12885e-6 × 2) = 60.1 mΩ
    expect(wr.primary.resistance_mohm).toBeCloseTo(60.1, 0)
  })

  it('secondary resistance ≈ 30 mΩ (half the primary for Ns = 10)', () => {
    expect(wr.secondary[0].resistance_mohm).toBeCloseTo(30.0, 0)
  })
})

// ── Dowell proximity factor ───────────────────────────────────────────────────

describe('Dowell proximity factor (primary, layers = 1)', () => {
  const wr = designWinding('flyback', spec, result, core)

  it('Fr > 1 (skin effect raises Rac above Rdc)', () => {
    expect(wr.proximity_loss_factor).toBeGreaterThan(1)
  })

  it('Fr ≈ 1.58 for AWG 26 at 100 kHz, 1 layer', () => {
    // η = (0.405/0.2093) × √(π/4) = 1.7147
    // term1 = η × (sinh2η + sin2η)/(cosh2η − cos2η) ≈ 1.580
    expect(wr.proximity_loss_factor).toBeCloseTo(1.58, 1)
  })

  it('Fr < 2 at 100 kHz single layer → no proximity warning', () => {
    const hasProximityWarn = wr.warnings.some(w => w.includes('proximity'))
    expect(hasProximityWarn).toBe(false)
  })
})

// ── Fill factor ───────────────────────────────────────────────────────────────

describe('fill factor', () => {
  const wr = designWinding('flyback', spec, result, core)

  it('fill_factor_pct > 0 for primary and secondary', () => {
    expect(wr.primary.fill_factor_pct).toBeGreaterThan(0)
    expect(wr.secondary[0].fill_factor_pct).toBeGreaterThan(0)
  })

  it('bobbin_fill_check is true (fill well below 60 %)', () => {
    expect(wr.bobbin_fill_check).toBe(true)
  })

  it('total fill < 20 % for this small transformer (sanity check)', () => {
    const total = wr.primary.fill_factor_pct + wr.secondary[0].fill_factor_pct
    expect(total).toBeLessThan(20)
  })
})

// ── Leakage inductance ────────────────────────────────────────────────────────

describe('leakage inductance', () => {
  const wr = designWinding('flyback', spec, result, core)

  it('estimated_leakage_nh > 0', () => {
    expect(wr.estimated_leakage_nh).toBeGreaterThan(0)
  })

  it('interleaved leakage ≈ 33 nH (4× reduction vs non-interleaved 133 nH)', () => {
    // Llk_non-int = μ₀ × 400 × 0.045 × (0.1e-3) / 0.017 = 132.9 nH
    // interleaved = 132.9/4 = 33.2 nH
    expect(wr.estimated_leakage_nh).toBeCloseTo(33.2, 0)
  })
})

// ── Copper loss ───────────────────────────────────────────────────────────────

describe('total copper loss', () => {
  const wr = designWinding('flyback', spec, result, core)

  it('total_copper_loss > 0', () => {
    expect(wr.total_copper_loss).toBeGreaterThan(0)
  })

  it('total_copper_loss is finite and reasonable (< 5 W for 25 W converter)', () => {
    expect(isFinite(wr.total_copper_loss)).toBe(true)
    expect(wr.total_copper_loss).toBeLessThan(5)
  })
})

// ── Creepage / clearance (IEC 62368-1) ───────────────────────────────────────

describe('creepage and clearance', () => {
  it('clampVoltage 21 V (≤ 50 V) → creepage = 1.5 mm', () => {
    const wr = designWinding('flyback', spec, result, core)
    expect(wr.creepage_mm).toBe(1.5)
  })

  it('clampVoltage 21 V → clearance = 0.8 mm', () => {
    const wr = designWinding('flyback', spec, result, core)
    expect(wr.clearance_mm).toBe(0.8)
  })

  it('clampVoltage 200 V (> 150 V, ≤ 300 V) → creepage = 4.0 mm', () => {
    const highVResult: DesignResult = { ...result, clampVoltage: 200 }
    const wr = designWinding('flyback', spec, highVResult, core)
    expect(wr.creepage_mm).toBe(4.0)
  })

  it('clampVoltage 400 V (> 300 V, ≤ 600 V) → creepage = 8.0 mm', () => {
    const highVResult: DesignResult = { ...result, clampVoltage: 400 }
    const wr = designWinding('flyback', spec, highVResult, core)
    expect(wr.creepage_mm).toBe(8.0)
  })
})

// ── Missing turns (error path) ────────────────────────────────────────────────

describe('error handling', () => {
  it('returns empty result with warning when primaryTurns is undefined', () => {
    const badResult: DesignResult = { ...result, primaryTurns: undefined }
    const wr = designWinding('flyback', spec, badResult, core)
    expect(wr.warnings.length).toBeGreaterThan(0)
    expect(wr.primary.turns).toBe(0)
  })
})

// ── High-frequency case (500 kHz → smaller AWG) ───────────────────────────────

describe('high-frequency wire selection (500 kHz)', () => {
  const hfSpec: DesignSpec = { ...spec, fsw: 500_000 }
  const wr = designWinding('flyback', hfSpec, result, core)

  it('skin_depth < 0.1 mm at 500 kHz', () => {
    // δ = 66.2/√500000 = 0.0936 mm
    expect(wr.skin_depth_mm).toBeCloseTo(0.0936, 3)
  })

  it('uses finer AWG than at 100 kHz (smaller d to satisfy d < 2δ)', () => {
    // 2δ = 0.187 mm → need AWG ≤ 34 (0.161 mm)
    expect(wr.primary.wire_gauge_awg).toBeGreaterThanOrEqual(30)
  })

  it('uses more strands than at 100 kHz to carry the same current', () => {
    const wr100k = designWinding('flyback', spec, result, core)
    expect(wr.primary.strands).toBeGreaterThan(wr100k.primary.strands)
  })
})

// ── Forward topology ──────────────────────────────────────────────────────────

describe('forward topology', () => {
  const fwdResult: DesignResult = {
    ...result,
    dutyCycle: 0.4,
    primaryTurns: 15,
    secondaryTurns: 8,
    turnsRatio: 15 / 8,
  }

  it('produces a valid WindingResult for forward', () => {
    const wr = designWinding('forward', spec, fwdResult, core)
    expect(wr.primary.turns).toBe(15)
    expect(wr.secondary[0].turns).toBe(8)
  })

  it('winding_order for forward with one secondary is interleaved', () => {
    const wr = designWinding('forward', spec, fwdResult, core)
    expect(wr.winding_order).toEqual(['Primary (½)', 'Secondary 1', 'Primary (½)'])
  })

  it('secondary RMS = Iout × √D for forward', () => {
    const wr = designWinding('forward', spec, fwdResult, core)
    // secondary strands should reflect forwardSecondaryRms(5, 0.4) = 3.162 A
    expect(wr.secondary[0].strands).toBeGreaterThanOrEqual(1)
    expect(wr.secondary[0].resistance_mohm).toBeGreaterThan(0)
  })
})
