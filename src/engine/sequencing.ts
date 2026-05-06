// Power sequencing analysis for multi-rail systems
// References: TI SLVA722 — Power Supply Sequencing in Multi-Voltage Systems
//             ON Semiconductor AND9166 — Sequencing Considerations for Multi-Rail Supplies
//             TI SLVA236A eq. 4 — PG delay from soft-start and settling time

import type { DesignSpec, DesignResult } from './types'
import type { TransientResult } from './topologies/types'

// ── Public types ──────────────────────────────────────────────────────────────

export interface SequencingRail {
  id: string
  name: string
  vout: number      // V — output voltage
  tss: number       // s — soft-start time
  pg_delay: number  // s — total time from enable assertion to PG assertion
  spec?: DesignSpec  // present when loaded from a .pswb file
}

export interface RailTiming {
  name: string
  vout: number
  tss: number            // s
  pg_delay: number       // s
  enable_time_ms: number // absolute time when enable is asserted
  pg_time_ms: number     // absolute time when PG is asserted
}

export interface TimingEvent {
  rail: string
  event: 'enable' | 'pg'
  time_ms: number
}

export interface SequencingResult {
  rails: RailTiming[]           // in the order they were analyzed (user order)
  sequencing_order: string[]    // recommended order (auto-sorted by voltage group)
  timing_diagram: TimingEvent[]
  warnings: string[]
  total_time_ms: number
}

// ── PG delay estimation ───────────────────────────────────────────────────────

// TI SLVA236A eq. 4: PG delay = soft-start time + loop settling time
// Settling time: use startup transient result when available, otherwise estimate
// 5 loop time-constants where τ = 1/fc and fc ≈ fsw/10 (design rule of thumb).
export function estimatePgDelay(
  tss: number,
  spec: DesignSpec,
  transientResult?: TransientResult | null,
): number {
  const settling_s = transientResult
    ? transientResult.metrics.settling_time_ms / 1000
    : 50 / spec.fsw  // 5 × (1/fc), fc = fsw/10
  return tss + settling_s
}

// ── Auto-ordering ─────────────────────────────────────────────────────────────

// TI SLVA722 Table 1 — Recommended power-up sequence by voltage level:
//   Core / digital (≤ 1.8 V) → I/O (≤ 3.3 V) → Analog / high-voltage (> 3.3 V)
function railGroup(vout: number): number {
  if (vout <= 1.8) return 0
  if (vout <= 3.3) return 1
  return 2
}

export function recommendedOrder(rails: SequencingRail[]): string[] {
  return [...rails]
    .sort((a, b) => {
      const g = railGroup(a.vout) - railGroup(b.vout)
      return g !== 0 ? g : a.vout - b.vout
    })
    .map((r) => r.name)
}

// ── Core analysis ─────────────────────────────────────────────────────────────

// analyzeSequencing processes rails in the given order (caller decides ordering).
// Pass rails pre-sorted by recommendedOrder() for automatic sequencing,
// or in any user-defined order to evaluate a custom sequence.
export function analyzeSequencing(rails: SequencingRail[]): SequencingResult {
  if (rails.length === 0) {
    return {
      rails: [],
      sequencing_order: [],
      timing_diagram: [],
      warnings: [],
      total_time_ms: 0,
    }
  }

  const warnings: string[] = []
  const seenConflicts = new Set<string>()

  // Build sequential chain: each rail enables when the previous rail asserts PG
  const timing_diagram: TimingEvent[] = []
  const railTimings: RailTiming[] = []
  let cursor_ms = 0

  for (const rail of rails) {
    const enable_ms = cursor_ms
    const pg_ms = cursor_ms + rail.pg_delay * 1000

    timing_diagram.push({ rail: rail.name, event: 'enable', time_ms: enable_ms })
    timing_diagram.push({ rail: rail.name, event: 'pg',     time_ms: pg_ms })

    railTimings.push({
      name:           rail.name,
      vout:           rail.vout,
      tss:            rail.tss,
      pg_delay:       rail.pg_delay,
      enable_time_ms: enable_ms,
      pg_time_ms:     pg_ms,
    })

    cursor_ms = pg_ms
  }

  const total_time_ms = cursor_ms

  // ── Warnings ────────────────────────────────────────────────────────────────

  if (rails.length === 1) {
    warnings.push(
      'Only one rail defined — add more rails to analyze multi-rail sequencing.',
    )
  }

  if (total_time_ms > 100) {
    warnings.push(
      `Total sequencing time is ${total_time_ms.toFixed(1)} ms — system boot may be slow.`,
    )
  }

  // Warn when all delays are near-zero (simultaneous startup)
  const allInstant = rails.every((r) => r.pg_delay < 0.002)
  if (rails.length > 1 && allInstant) {
    warnings.push(
      'No sequencing delay configured — all rails start simultaneously. ' +
      'Risk of excessive inrush and incomplete startup.',
    )
  }

  // Conflict: rail A depends on rail B when B.vout ∈ A.spec.vinMin..vinMax.
  // If A enables before B reaches PG, latch-up or brown-out may occur.
  for (const aT of railTimings) {
    const aRail = rails.find((r) => r.name === aT.name)
    if (!aRail?.spec) continue

    for (const bT of railTimings) {
      if (aT.name === bT.name) continue
      const bRail = rails.find((r) => r.name === bT.name)
      if (!bRail) continue

      const bIsInputForA =
        aRail.spec.vinMin <= bRail.vout && bRail.vout <= aRail.spec.vinMax

      if (bIsInputForA && aT.enable_time_ms < bT.pg_time_ms) {
        const key = `${aT.name}→${bT.name}`
        if (!seenConflicts.has(key)) {
          seenConflicts.add(key)
          warnings.push(
            `Rail "${aT.name}" enables before "${bT.name}" reaches power-good ` +
            `— may cause brown-out or latch-up.`,
          )
        }
      }
    }
  }

  return {
    rails: railTimings,
    sequencing_order: recommendedOrder(rails),
    timing_diagram,
    warnings,
    total_time_ms,
  }
}
