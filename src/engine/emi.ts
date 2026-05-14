// EMI estimation: harmonic spectrum of a trapezoidal switching current
// evaluated against CISPR 32 Class B conducted emission limits (150 kHz – 30 MHz).
import type { DesignSpec, EMIResult, EMIHarmonic } from './topologies/types'
import { getClassBLimit } from './emi/limits'
import { harmonicAmplitude_dbuv } from './emi/harmonic'
import { suggestDmFilter } from './emi/filter-suggest'

export type { EMIDesignResult } from './emi/harmonic'

export function estimateEMI(_topology: string, spec: DesignSpec, result: import('./emi/harmonic').EMIDesignResult): EMIResult {
  const fsw    = spec.fsw || 200000
  const D      = result.dutyCycle || result.duty_cycle || 0.5
  const Ipeak  = result.peakCurrent || result.inductor?.peak_current || spec.iout_max || 1
  const tr     = 20e-9
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
