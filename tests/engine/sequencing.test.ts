// Power sequencing analysis tests
// Reference: TI SLVA722 — Power Supply Sequencing in Multi-Voltage Systems
//            ON Semiconductor AND9166 — Power Sequencing Considerations
//
// Hand calculations for timing verification:
//
// Test setup — three rails:
//   A: name=VDD_CORE, vout=1.2 V, tss=2 ms, pg_delay=4 ms
//   B: name=VDD_IO,   vout=3.3 V, tss=3 ms, pg_delay=5 ms
//   C: name=VDD_ANA,  vout=5.0 V, tss=5 ms, pg_delay=8 ms
//
// Auto-order (by voltage group then vout): VDD_CORE → VDD_IO → VDD_ANA
//
// Sequential chain timing:
//   VDD_CORE: enable=0,        pg=4 ms
//   VDD_IO:   enable=4 ms,     pg=4+5=9 ms
//   VDD_ANA:  enable=9 ms,     pg=9+8=17 ms
//   total=17 ms
//
// PG delay formula (TI SLVA236A eq. 4):
//   pg_delay = tss + settling
//   settling (no transient) = 50 / fsw = 50 / 200000 = 0.00025 s = 0.25 ms
//   pg_delay = 0.002 + 0.00025 = 0.00225 s = 2.25 ms

import { describe, it, expect } from 'vitest'
import {
  analyzeSequencing,
  estimatePgDelay,
  recommendedOrder,
} from '../../src/engine/sequencing'
import type { SequencingRail } from '../../src/engine/sequencing'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CORE: SequencingRail = {
  id: 'a',
  name: 'VDD_CORE',
  vout: 1.2,
  tss: 0.002,
  pg_delay: 0.004,
}

const IO: SequencingRail = {
  id: 'b',
  name: 'VDD_IO',
  vout: 3.3,
  tss: 0.003,
  pg_delay: 0.005,
}

const ANA: SequencingRail = {
  id: 'c',
  name: 'VDD_ANA',
  vout: 5.0,
  tss: 0.005,
  pg_delay: 0.008,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('analyzeSequencing', () => {
  it('empty input returns empty result', () => {
    const r = analyzeSequencing([])
    expect(r.rails).toHaveLength(0)
    expect(r.timing_diagram).toHaveLength(0)
    expect(r.warnings).toHaveLength(0)
    expect(r.total_time_ms).toBe(0)
  })

  it('sequential chain timing — three rails in recommended order', () => {
    // Pass rails already sorted to match sequential chain expectation
    const r = analyzeSequencing([CORE, IO, ANA])

    // enable and PG times
    expect(r.rails[0].name).toBe('VDD_CORE')
    expect(r.rails[0].enable_time_ms).toBeCloseTo(0, 6)
    expect(r.rails[0].pg_time_ms).toBeCloseTo(4, 6)   // 0 + 4 ms

    expect(r.rails[1].name).toBe('VDD_IO')
    expect(r.rails[1].enable_time_ms).toBeCloseTo(4, 6)   // starts when CORE reaches PG
    expect(r.rails[1].pg_time_ms).toBeCloseTo(9, 6)   // 4 + 5 ms

    expect(r.rails[2].name).toBe('VDD_ANA')
    expect(r.rails[2].enable_time_ms).toBeCloseTo(9, 6)
    expect(r.rails[2].pg_time_ms).toBeCloseTo(17, 6)  // 9 + 8 ms

    expect(r.total_time_ms).toBeCloseTo(17, 6)
  })

  it('timing_diagram has enable and pg events for each rail', () => {
    const r = analyzeSequencing([CORE, IO])
    const events = r.timing_diagram

    const coreEnable = events.find((e) => e.rail === 'VDD_CORE' && e.event === 'enable')
    const corePg     = events.find((e) => e.rail === 'VDD_CORE' && e.event === 'pg')
    const ioEnable   = events.find((e) => e.rail === 'VDD_IO'   && e.event === 'enable')

    expect(coreEnable?.time_ms).toBeCloseTo(0, 6)
    expect(corePg?.time_ms).toBeCloseTo(4, 6)
    expect(ioEnable?.time_ms).toBeCloseTo(4, 6)   // IO enables when CORE reaches PG
  })

  it('recommendedOrder — lowest voltage first within each group', () => {
    const rails: SequencingRail[] = [ANA, CORE, IO]  // out of order
    const order = recommendedOrder(rails)
    expect(order).toEqual(['VDD_CORE', 'VDD_IO', 'VDD_ANA'])
  })

  it('recommendedOrder — multiple rails in same group sorted by vout', () => {
    const r1: SequencingRail = { id: 'x', name: '1V8', vout: 1.8, tss: 0.002, pg_delay: 0.003 }
    const r2: SequencingRail = { id: 'y', name: '1V0', vout: 1.0, tss: 0.002, pg_delay: 0.003 }
    const r3: SequencingRail = { id: 'z', name: '1V2', vout: 1.2, tss: 0.002, pg_delay: 0.003 }
    const order = recommendedOrder([r1, r2, r3])
    expect(order).toEqual(['1V0', '1V2', '1V8'])
  })

  it('warning: only one rail defined', () => {
    const r = analyzeSequencing([CORE])
    expect(r.warnings.some((w) => w.includes('Only one rail'))).toBe(true)
  })

  it('warning: total time > 100 ms', () => {
    const slowRail: SequencingRail = {
      id: 'slow',
      name: 'SlowRail',
      vout: 3.3,
      tss: 0.04,
      pg_delay: 0.055, // 55 ms
    }
    const slowRail2: SequencingRail = {
      id: 'slow2',
      name: 'SlowRail2',
      vout: 5.0,
      tss: 0.04,
      pg_delay: 0.055,
    }
    // Two 55ms rails = 110ms total
    const r = analyzeSequencing([slowRail, slowRail2])
    expect(r.total_time_ms).toBeCloseTo(110, 4)
    expect(r.warnings.some((w) => w.includes('110'))).toBe(true)
  })

  it('warning: simultaneous rails (all pg_delay near zero)', () => {
    const instant1: SequencingRail = { id: '1', name: 'R1', vout: 1.0, tss: 0.0001, pg_delay: 0.0001 }
    const instant2: SequencingRail = { id: '2', name: 'R2', vout: 3.3, tss: 0.0001, pg_delay: 0.0001 }
    const r = analyzeSequencing([instant1, instant2])
    expect(r.warnings.some((w) => w.includes('simultaneously'))).toBe(true)
  })

  it('conflict warning: dependent rail enables before its input supply reaches PG', () => {
    // R1 is a 12V supply; R2 uses vinMin=10, vinMax=14 → depends on R1
    const supply: SequencingRail = {
      id: 'sup',
      name: 'V12',
      vout: 12,
      tss: 0.010,
      pg_delay: 0.012,
    }
    const dependent: SequencingRail = {
      id: 'dep',
      name: 'V5',
      vout: 5,
      tss: 0.003,
      pg_delay: 0.005,
      spec: {
        vinMin: 10,
        vinMax: 14,
        vout: 5,
        iout: 2,
        fsw: 200_000,
        rippleRatio: 0.3,
        ambientTemp: 25,
        voutRippleMax: 0.05,
        efficiency: 0.9,
      },
    }
    // If dependent comes BEFORE supply in the order, dependent enables before supply reaches PG
    // dependent enable=0, supply enable=5ms, supply PG=17ms
    // dependent.enable(0) < supply.PG(17ms) → conflict
    const r = analyzeSequencing([dependent, supply])
    expect(r.warnings.some((w) => w.includes('brown-out'))).toBe(true)
  })

  it('no conflict when dependent comes after its input supply in the chain', () => {
    const supply: SequencingRail = {
      id: 'sup',
      name: 'V12',
      vout: 12,
      tss: 0.010,
      pg_delay: 0.012,
    }
    const dependent: SequencingRail = {
      id: 'dep',
      name: 'V5',
      vout: 5,
      tss: 0.003,
      pg_delay: 0.005,
      spec: {
        vinMin: 10,
        vinMax: 14,
        vout: 5,
        iout: 2,
        fsw: 200_000,
        rippleRatio: 0.3,
        ambientTemp: 25,
        voutRippleMax: 0.05,
        efficiency: 0.9,
      },
    }
    // supply first: supply PG=12ms, dependent enable=12ms → no conflict
    const r = analyzeSequencing([supply, dependent])
    expect(r.warnings.some((w) => w.includes('brown-out'))).toBe(false)
  })
})

describe('estimatePgDelay', () => {
  it('uses transient settling time when available', () => {
    const spec = {
      vinMin: 10, vinMax: 15, vout: 5, iout: 2,
      fsw: 200_000, rippleRatio: 0.3, ambientTemp: 25,
      voutRippleMax: 0.05, efficiency: 0.9,
    }
    const transient = {
      time: new Float64Array(0),
      vout: new Float64Array(0),
      iL: new Float64Array(0),
      duty: new Float64Array(0),
      metrics: { settling_time_ms: 3.0, overshoot_pct: 2.0, peak_inrush_A: 5.0 },
    }
    // pg_delay = tss + settling = 0.002 + 0.003 = 0.005 s
    const pd = estimatePgDelay(0.002, spec, transient)
    expect(pd).toBeCloseTo(0.005, 6)
  })

  it('estimates settling as 50/fsw when no transient result provided', () => {
    const spec = {
      vinMin: 10, vinMax: 15, vout: 5, iout: 2,
      fsw: 200_000, rippleRatio: 0.3, ambientTemp: 25,
      voutRippleMax: 0.05, efficiency: 0.9,
    }
    // settling = 50 / 200000 = 0.00025 s
    // pg_delay = 0.002 + 0.00025 = 0.00225 s
    const pd = estimatePgDelay(0.002, spec, null)
    expect(pd).toBeCloseTo(0.00225, 6)
  })
})
