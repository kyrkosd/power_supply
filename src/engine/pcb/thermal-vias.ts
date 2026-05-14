// Thermal-via recommendations for power-dissipating components.
// Rule of thumb: 1 thermal via (ø0.3 mm) ≈ 0.2 W conductance through FR4.

import type { DesignResult } from '../types'
import type { TopologyId } from '../../store/workbenchStore'
import type { ThermalVia } from './types'

const WATTS_PER_VIA = 0.2
const VIA_DIAM_MM   = 0.3

function thermalVia(component: string, plossW: number, reason: string): ThermalVia | null {
  if (plossW < 0.5) return null
  return {
    component,
    via_count:       Math.ceil(plossW / WATTS_PER_VIA),
    via_diameter_mm: VIA_DIAM_MM,
    reason,
  }
}

/** Sum the MOSFET, diode, and core loss buckets from result.losses. */
function loadLosses(result: DesignResult) {
  const losses = result.losses ?? {}
  return {
    mosfet: (losses.mosfet ?? 0) + (losses.mosfet_conduction ?? 0) + (losses.mosfet_switching ?? 0),
    diode:  (losses.diode  ?? 0) + (losses.diode_conduction  ?? 0),
    core:   (losses.core   ?? 0) + (losses.inductor_core    ?? 0),
  }
}

/** Build thermal-via recommendations for every power-dissipating component. */
export function computeThermalVias(topology: TopologyId, result: DesignResult): ThermalVia[] {
  if (!result.losses) return []
  const { mosfet, diode, core } = loadLosses(result)
  const vias: ThermalVia[] = []

  if (mosfet > 0.1) {
    const v = thermalVia('Q1 (MOSFET)', mosfet, `${mosfet.toFixed(1)} W conduction + switching losses`)
    if (v) vias.push(v)
  }
  if (diode > 0.1) {
    const v = thermalVia('D1 (output diode)', diode, `${diode.toFixed(1)} W forward-conduction losses`)
    if (v) vias.push(v)
  }
  if ((topology === 'flyback' || topology === 'forward') && core > 0.5) {
    vias.push({
      component:       'T1 (transformer)',
      via_count:       Math.ceil(core / WATTS_PER_VIA),
      via_diameter_mm: VIA_DIAM_MM,
      reason:          `${core.toFixed(1)} W core loss; use a copper pour under the core mounting pads.`,
    })
  }

  return vias
}
