import type { DesignSpec } from '../types'
import type { TransientResult } from '../topologies/types'
import type { SequencingRail, RailTiming, TimingEvent } from './types'

// TI SLVA236A eq. 4: PG delay = soft-start time + loop settling time.
export function estimatePgDelay(
  tss: number,
  spec: DesignSpec,
  transientResult?: TransientResult | null,
): number {
  const settling_s = transientResult
    ? transientResult.metrics.settling_time_ms / 1000
    : 50 / spec.fsw
  return tss + settling_s
}

// TI SLVA722 Table 1 — core/digital (≤ 1.8 V) → I/O (≤ 3.3 V) → analog/HV (> 3.3 V)
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

export function buildTimingChain(rails: SequencingRail[]) {
  const timing_diagram: TimingEvent[] = []
  const railTimings: RailTiming[]     = []
  let cursor_ms = 0

  for (const rail of rails) {
    const enable_ms = cursor_ms
    const pg_ms     = cursor_ms + rail.pg_delay * 1000
    timing_diagram.push({ rail: rail.name, event: 'enable', time_ms: enable_ms })
    timing_diagram.push({ rail: rail.name, event: 'pg',     time_ms: pg_ms })
    railTimings.push({
      name: rail.name, vout: rail.vout, tss: rail.tss, pg_delay: rail.pg_delay,
      enable_time_ms: enable_ms, pg_time_ms: pg_ms,
    })
    cursor_ms = pg_ms
  }
  return { timing_diagram, railTimings, total_time_ms: cursor_ms }
}
