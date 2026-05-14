import type { DesignSpec, DesignResult } from '../types'
import type { InductorData } from '../component-selector'

// DCR-limited inrush current estimate at power-on.
// TI SLVA236A eq. 2: I_inrush = Vin / DCR.
// Falls back to ~10 mΩ/µH heuristic when no inductor is selected.
export function computeDcrInrush(spec: DesignSpec, result: DesignResult, inductor?: InductorData | null) {
  const dcr_known = !!(inductor && inductor.dcr_mohm > 0)
  const dcr_ohm   = dcr_known
    ? inductor!.dcr_mohm * 1e-3
    : Math.max(0.010, result.inductance * 1e4)
  return { dcr_known, dcr_ohm, peak_inrush_a: spec.vinMax / dcr_ohm }
}
