import type { SequencingRail, RailTiming } from './types'

function isBrownOutConflict(
  aT: RailTiming,
  bT: RailTiming,
  aSpec: NonNullable<SequencingRail['spec']>,
  bRail: SequencingRail,
): boolean {
  return aSpec.vinMin <= bRail.vout
    && bRail.vout <= aSpec.vinMax
    && aT.enable_time_ms < bT.pg_time_ms
}

function checkPairConflict(
  aT: RailTiming,
  bT: RailTiming,
  aRailSpec: NonNullable<SequencingRail['spec']>,
  rails: SequencingRail[],
  seenConflicts: Set<string>,
  warnings: string[],
): void {
  if (aT.name === bT.name) return
  const bRail = rails.find((r) => r.name === bT.name)
  if (!bRail) return
  if (!isBrownOutConflict(aT, bT, aRailSpec, bRail)) return
  const key = `${aT.name}→${bT.name}`
  if (seenConflicts.has(key)) return
  seenConflicts.add(key)
  warnings.push(
    `Rail "${aT.name}" enables before "${bT.name}" reaches power-good ` +
    `— may cause brown-out or latch-up.`,
  )
}

export function checkConflicts(railTimings: RailTiming[], rails: SequencingRail[]): string[] {
  const warnings: string[] = []
  const seenConflicts      = new Set<string>()

  for (const aT of railTimings) {
    const aRail = rails.find((r) => r.name === aT.name)
    if (!aRail?.spec) continue
    for (const bT of railTimings) checkPairConflict(aT, bT, aRail.spec, rails, seenConflicts, warnings)
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
