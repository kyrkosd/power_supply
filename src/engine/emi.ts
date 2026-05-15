// EMI estimation: harmonic spectrum of a trapezoidal switching current
// evaluated against CISPR 32 Class B conducted emission limits (150 kHz – 30 MHz).
import type { DesignSpec, EMIResult, EMIHarmonic } from './topologies/types'
import { getClassBLimit } from './emi/limits'
import { harmonicAmplitude_dbuv } from './emi/harmonic'
import { suggestDmFilter } from './emi/filter-suggest'
import { extractEmiParams } from './emi/params'

export type { EMIDesignResult } from './emi/harmonic'

// Called by: worker/compute.ts (applyOptionalAnalyses) — runs in the worker after the base
// topology compute() so it can use peakCurrent and dutyCycle from the steady-state result.
// The _topology parameter is accepted for future topology-specific harmonic models (e.g.,
// flyback primary-current envelope differs from buck) but is currently unused; the trapezoidal
// spectrum model is applied uniformly. The EMIResult feeds the input-filter designer that runs
// next in the same optional-analyses chain.
export function estimateEMI(_topology: string, spec: DesignSpec, result: import('./emi/harmonic').EMIDesignResult): EMIResult {
  const { fsw, D, Ipeak, tr } = extractEmiParams(spec, result)
  const n_max  = Math.floor(30e6 / fsw)

  const harmonics: EMIHarmonic[] = []
  let worst_margin_db = Infinity
  let first_failing_harmonic: number | null = null

  for (let n = 1; n <= n_max; n++) {
    const freq   = n * fsw
    if (freq < 150e3) continue
    const dbuv   = harmonicAmplitude_dbuv(n, fsw, D, tr, Ipeak)
    const limit  = getClassBLimit(freq)
    const margin = limit - dbuv
    if (margin < worst_margin_db)             worst_margin_db = margin
    if (margin < 0 && first_failing_harmonic === null) first_failing_harmonic = freq
    harmonics.push({ frequency: freq, amplitude_dbuv: dbuv, limit_dbuv: limit, margin_db: margin })
  }

  return {
    harmonics,
    worst_margin_db: worst_margin_db === Infinity ? 0 : worst_margin_db,
    first_failing_harmonic,
    suggested_filter: first_failing_harmonic != null && first_failing_harmonic > 0
      ? suggestDmFilter(worst_margin_db, first_failing_harmonic) : null,
  }
}
