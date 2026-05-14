import type { SequencingRail, RailTiming } from './types'

export function checkConflicts(railTimings: RailTiming[], rails: SequencingRail[]): string[] {
  const warnings: string[]        = []
  const seenConflicts = new Set<string>()

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
  return warnings
}

export function buildSequencingWarnings(
  rails: SequencingRail[],
  total_time_ms: number,
  conflictWarnings: string[],
): string[] {
  const warnings: string[] = []

  if (rails.length === 1)
    warnings.push('Only one rail defined — add more rails to analyze multi-rail sequencing.')
  if (total_time_ms > 100)
    warnings.push(`Total sequencing time is ${total_time_ms.toFixed(1)} ms — system boot may be slow.`)

  const allInstant = rails.every((r) => r.pg_delay < 0.002)
  if (rails.length > 1 && allInstant)
    warnings.push(
      'No sequencing delay configured — all rails start simultaneously. ' +
      'Risk of excessive inrush and incomplete startup.',
    )

  warnings.push(...conflictWarnings)
  return warnings
}
