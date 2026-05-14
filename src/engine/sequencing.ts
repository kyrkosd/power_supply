// Power sequencing analysis for multi-rail systems.
// References: TI SLVA722 — Power Supply Sequencing in Multi-Voltage Systems
//             ON Semiconductor AND9166 — Sequencing Considerations for Multi-Rail Supplies
//             TI SLVA236A eq. 4 — PG delay from soft-start and settling time
import type { DesignSpec } from './types'
import type { TransientResult } from './topologies/types'
import type { SequencingResult } from './sequencing/types'
import { estimatePgDelay, recommendedOrder, buildTimingChain } from './sequencing/timing'
import { checkConflicts, buildSequencingWarnings } from './sequencing/warnings'

export type { SequencingRail, RailTiming, TimingEvent, SequencingResult } from './sequencing/types'
export { estimatePgDelay, recommendedOrder }

export function analyzeSequencing(
  rails: import('./sequencing/types').SequencingRail[],
): SequencingResult {
  if (rails.length === 0)
    return { rails: [], sequencing_order: [], timing_diagram: [], warnings: [], total_time_ms: 0 }

  const { timing_diagram, railTimings, total_time_ms } = buildTimingChain(rails)
  const conflictWarnings = checkConflicts(railTimings, rails)
  const warnings         = buildSequencingWarnings(rails, total_time_ms, conflictWarnings)

  return { rails: railTimings, sequencing_order: recommendedOrder(rails), timing_diagram, warnings, total_time_ms }
}
