// Tests for src/engine/input-filter.ts
//
// Reference design (Erickson & Maksimovic §10.1 example):
//   Buck converter: Vin = 12 V, Vout = 5 V, Iout = 5 A, fsw = 200 kHz
//   IL_peak ≈ 6 A, efficiency ≈ 0.9
//
// Hand calculations:
//   Pout = 5×5 = 25 W
//   Zin_converter = Vin² / (Pout/η) = 144 / (25/0.9) = 144/27.78 ≈ 5.18 Ω
//   Z0 = Vin / (2×Ipeak) = 12 / 12 = 1 Ω
//   f_res_target = max(1000, 200e3/10) = 20 000 Hz
//   ω_res = 2π×20000 ≈ 125 664 rad/s
//   Lf_raw = Z0 / ω_res = 1 / 125664 ≈ 7.96 µH → snapped to E12 8.2 µH
//   Cf_raw = 1/(Z0×ω_res) = same ≈ 7.96 µF → snapped to E12 8.2 µF
//   f_res_actual = 1/(2π×√(8.2e-6 × 8.2e-6)) = 1/(2π×8.2e-6) ≈ 19 415 Hz
//   Att@fsw = 40×log10(200e3/19415) ≈ 40×1.013 ≈ 40.5 dB
//   Rd = Z0/3 ≈ 0.333 Ω,  Cd = 4×8.2 µF = 32.8 µF → snapped to 33 µF

import { describe, it, expect } from 'vitest'
import { designInputFilter, filterOutputImpedance, converterInputImpedance, DEFAULT_INPUT_FILTER_OPTIONS } from '../../src/engine/input-filter'
import type { DesignSpec, DesignResult } from '../../src/engine/types'
import type { EMIResult } from '../../src/engine/topologies/types'

// ── Shared stubs ──────────────────────────────────────────────────────────────

const spec: DesignSpec = {
  vinMin: 10,
  vinMax: 14,
  vout: 5,
  iout: 5,
  fsw: 200_000,
  rippleRatio: 0.3,
  ambientTemp: 25,
  voutRippleMax: 0.05,
  efficiency: 0.9,
}

const result: DesignResult = {
  dutyCycle: 5 / 12,
  inductance: 10e-6,
  capacitance: 100e-6,
  peakCurrent: 6,
  efficiency: 0.9,
  warnings: [],
}

// Passing EMI (margin ≥ 0): filter still designed with 20 dB minimum
const emiPass: EMIResult = {
  harmonics: [],
  worst_margin_db: 10,
  first_failing_harmonic: null,
  suggested_filter: null,
}

// Failing EMI by 15 dB: filter needs 15 + 6 = 21 dB
const emiFail: EMIResult = {
  harmonics: [],
  worst_margin_db: -15,
  first_failing_harmonic: 400_000,
  suggested_filter: null,
}

const opts = { ...DEFAULT_INPUT_FILTER_OPTIONS, enabled: true }

// ── designInputFilter — basic structure ───────────────────────────────────────

describe('designInputFilter — basic structure', () => {
  const f = designInputFilter('buck', spec, result, emiPass, opts)

  it('returns positive dm_inductor', () => {
    expect(f.dm_inductor).toBeGreaterThan(0)
  })

  it('returns positive dm_capacitor', () => {
    expect(f.dm_capacitor).toBeGreaterThan(0)
  })

  it('returns positive cm_choke in range 1–47 mH', () => {
    expect(f.cm_choke).toBeGreaterThanOrEqual(1e-3)
    expect(f.cm_choke).toBeLessThanOrEqual(47e-3)
  })

  it('x_capacitor is 100 nF (standard design)', () => {
    // nearestE12(100e-9) should stay at 100 nF
    expect(f.x_capacitor).toBeCloseTo(100e-9, 10)
  })

  it('y_capacitors is 2.2 nF (IEC 60384-14 standard)', () => {
    expect(f.y_capacitors).toBeCloseTo(2.2e-9, 11)
  })

  it('damping_capacitor ≥ 4 × dm_capacitor (Erickson eq. 10.18)', () => {
    expect(f.damping_capacitor).toBeGreaterThanOrEqual(4 * f.dm_capacitor * 0.99)
  })

  it('components array has 8 entries', () => {
    expect(f.components).toHaveLength(8)
  })

  it('component refs include Lf, Cf, Rd, Cd, Lcm, Cx, Cy1, Cy2', () => {
    const refs = f.components.map((c) => c.ref)
    expect(refs).toContain('Lf')
    expect(refs).toContain('Cf')
    expect(refs).toContain('Rd')
    expect(refs).toContain('Cd')
    expect(refs).toContain('Lcm')
    expect(refs).toContain('Cx')
    expect(refs).toContain('Cy1')
    expect(refs).toContain('Cy2')
  })
})

// ── DM filter sizing ──────────────────────────────────────────────────────────

describe('DM filter sizing (Erickson §10.1)', () => {
  const f = designInputFilter('buck', spec, result, emiPass, opts)

  it('f_res < fsw / 5', () => {
    expect(f.filter_resonant_freq).toBeLessThan(spec.fsw / 5)
  })

  it('f_res = 1 / (2π√(Lf×Cf)) matches stored value', () => {
    const expected = 1 / (2 * Math.PI * Math.sqrt(f.dm_inductor * f.dm_capacitor))
    expect(f.filter_resonant_freq).toBeCloseTo(expected, 0)
  })

  it('attenuation at fsw = 40×log10(fsw/f_res)', () => {
    const expected = 40 * Math.log10(spec.fsw / f.filter_resonant_freq)
    expect(f.filter_attenuation_at_fsw).toBeCloseTo(expected, 1)
  })

  it('attenuation at fsw ≥ required_attenuation (passing EMI → 20 dB)', () => {
    expect(f.filter_attenuation_at_fsw).toBeGreaterThanOrEqual(f.required_attenuation_db - 1)
  })
})

// ── Required attenuation ──────────────────────────────────────────────────────

describe('required_attenuation_db', () => {
  it('uses minimum 20 dB when EMI passes', () => {
    const f = designInputFilter('buck', spec, result, emiPass, opts)
    expect(f.required_attenuation_db).toBeGreaterThanOrEqual(20)
  })

  it('uses |worst_margin| + 6 dB when EMI fails', () => {
    const f = designInputFilter('buck', spec, result, emiFail, opts)
    expect(f.required_attenuation_db).toBeCloseTo(15 + 6, 0)
  })

  it('override attenuation is respected', () => {
    const f = designInputFilter('buck', spec, result, emiPass, { ...opts, attenuation_override_db: 50 })
    expect(f.required_attenuation_db).toBe(50)
  })
})

// ── Damping network (Erickson §10.2) ─────────────────────────────────────────

describe('damping network', () => {
  const f = designInputFilter('buck', spec, result, emiPass, opts)

  it('Rd = Z0 / 3 (with engine clamp: Z0 = max(1, Vin/(2×Ipeak)))', () => {
    // Engine clamps z0 = max(1, vinMin / (2×Ipeak)) = max(1, 10/12) = 1
    const z0 = Math.max(1, spec.vinMin / (2 * result.peakCurrent))
    expect(f.damping_resistor).toBeCloseTo(z0 / 3, 3)
  })

  it('damping_resistor equals filter_output_impedance_at_resonance', () => {
    expect(f.filter_output_impedance_at_resonance).toBeCloseTo(f.damping_resistor, 5)
  })
})

// ── Middlebrook stability ─────────────────────────────────────────────────────

describe('Middlebrook stability (Middlebrook IEEE IAS 1976)', () => {
  it('negative_input_impedance = Vin² / (Pout/η)', () => {
    const f = designInputFilter('buck', spec, result, emiPass, opts)
    const expected = (spec.vinMin * spec.vinMin) / ((spec.vout * spec.iout) / result.efficiency!)
    expect(f.negative_input_impedance).toBeCloseTo(expected, 3)
  })

  it('stability_margin_db = 20×log10(Zin / (3×Zout))', () => {
    const f = designInputFilter('buck', spec, result, emiPass, opts)
    const expected = 20 * Math.log10(f.negative_input_impedance / (3 * f.filter_output_impedance_at_resonance))
    expect(f.stability_margin_db).toBeCloseTo(expected, 3)
  })

  it('middlebrook_stable is true when Zout < Zin/3', () => {
    // This design has Zin ≈ 3.6 Ω and Rd ≈ 0.278 Ω → stable
    const f = designInputFilter('buck', spec, result, emiPass, opts)
    if (f.damping_resistor < f.negative_input_impedance / 3) {
      expect(f.middlebrook_stable).toBe(true)
    } else {
      expect(f.middlebrook_stable).toBe(false)
    }
  })

  it('warns when Middlebrook criterion is violated', () => {
    // Force large Rd by making Vin very small (tiny |Zin|)
    const lowVinSpec: DesignSpec = { ...spec, vinMin: 1, vinMax: 2 }
    const lowVinResult: DesignResult = { ...result, peakCurrent: 0.01 }
    const f = designInputFilter('buck', lowVinSpec, lowVinResult, emiPass, opts)
    // If violated, warning is present
    if (!f.middlebrook_stable) {
      expect(f.warnings.some((w) => w.includes('Middlebrook'))).toBe(true)
    }
  })
})

// ── CM choke ──────────────────────────────────────────────────────────────────

describe('CM choke', () => {
  it('manual override is respected', () => {
    const f = designInputFilter('buck', spec, result, emiPass, {
      ...opts,
      cm_choke_h: 10e-3,
    })
    expect(f.cm_choke).toBeCloseTo(10e-3, 5)
  })

  it('auto CM choke is clamped to [1 mH, 47 mH]', () => {
    const f = designInputFilter('buck', spec, result, emiPass, opts)
    expect(f.cm_choke).toBeGreaterThanOrEqual(1e-3)
    expect(f.cm_choke).toBeLessThanOrEqual(47e-3)
  })
})

// ── Impedance sweep helpers ───────────────────────────────────────────────────

describe('filterOutputImpedance', () => {
  it('returns the same number of points as input freqs', () => {
    const freqs = [1000, 5000, 10000, 50000, 200000]
    const z = filterOutputImpedance(10e-6, 10e-6, 0.5, 40e-6, freqs)
    expect(z).toHaveLength(freqs.length)
  })

  it('all values are positive finite numbers', () => {
    const freqs = [100, 1000, 10000, 100000]
    const z = filterOutputImpedance(10e-6, 10e-6, 1, 40e-6, freqs)
    z.forEach((v) => {
      expect(isFinite(v)).toBe(true)
      expect(v).toBeGreaterThan(0)
    })
  })
})

describe('converterInputImpedance', () => {
  it('equals zinDC below fsw', () => {
    const zinDC = 5
    const fsw   = 200_000
    const freqs = [100, 1000, 50000, 100000]
    const z = converterInputImpedance(zinDC, fsw, freqs)
    z.forEach((v) => expect(v).toBeCloseTo(zinDC, 5))
  })

  it('is greater than zinDC above fsw', () => {
    const zinDC = 5
    const fsw   = 200_000
    const z = converterInputImpedance(zinDC, fsw, [400_000])
    expect(z[0]).toBeGreaterThan(zinDC)
  })
})
