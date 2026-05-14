// PCB layout guide — public entry point.
// Pure engine module: no React, no DOM, no Zustand.
// Per-concern data lives in src/engine/pcb/{loops,placement,keep-outs,tips,trace-width,thermal-vias}.ts
//
// References:
//   IPC-2221A §6.2 (trace width)
//   IEC 62368-1:2018 Table F.5 (creepage / clearance)
//   TI SLVA959, AN-1149 (general layout best practice)

import type { DesignSpec, DesignResult } from './types'
import type { TopologyId } from '../store/workbenchStore'
import type { LayoutGuidelines } from './pcb/types'
import { loopsForTopology }      from './pcb/loops'
import { placementForTopology }  from './pcb/placement'
import { keepOutsForTopology }   from './pcb/keep-outs'
import { tipsForTopology }       from './pcb/tips'
import { computeTraceWidths }    from './pcb/trace-width'
import { computeThermalVias }    from './pcb/thermal-vias'

export type {
  CriticalLoop,
  TraceWidth,
  PlacementStep,
  ThermalVia,
  KeepOut,
  LayoutGuidelines,
} from './pcb/types'

/**
 * Generate a complete PCB layout guide for a computed switching-supply design.
 *
 * @param topology Converter topology identifier
 * @param spec     Design specification (Vin, Vout, Iout, fsw, efficiency)
 * @param result   Computed design result (peakCurrent, losses, turnsRatio, …)
 * @returns        Structured layout guidelines ready for display or PDF export
 */
export function generateLayoutGuidelines(
  topology: TopologyId,
  spec: DesignSpec,
  result: DesignResult,
): LayoutGuidelines {
  return {
    critical_loops:  loopsForTopology(topology),
    trace_widths:    computeTraceWidths(topology, spec, result),
    placement_order: placementForTopology(topology),
    thermal_vias:    computeThermalVias(topology, result),
    keep_outs:       keepOutsForTopology(topology, spec),
    general_tips:    tipsForTopology(topology, spec),
  }
}
