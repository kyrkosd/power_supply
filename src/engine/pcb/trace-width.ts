// IPC-2221 external-layer trace-width calculator.
// Table 6.2: W [mils] = I / (k × ΔT^b)^(1/c) / thickness [mils]
// 1 oz copper ≈ 1.378 mils thick; 2 oz ≈ 2.756 mils.

import type { DesignSpec, DesignResult } from '../types'
import type { TopologyId } from '../../store/workbenchStore'
import type { TraceWidth } from './types'

const IPC2221_K   = 0.048
const IPC2221_B   = 0.44
const IPC2221_C   = 0.725
const DELTA_T     = 10    // °C temperature rise target
const MILS_PER_MM = 39.3701

function ipc2221Width(current_a: number, thickness_oz: 1 | 2): number {
  const thicknessMils = thickness_oz === 1 ? 1.378 : 2.756
  const areaMils2     = (current_a / (IPC2221_K * Math.pow(DELTA_T, IPC2221_B))) ** (1 / IPC2221_C)
  return (areaMils2 / thicknessMils) / MILS_PER_MM
}

/** Single trace-width row: rounds widths to 0.01 mm and floors at 0.2 mm. */
export function makeTrace(net: string, current_a: number): TraceWidth {
  const w1oz = ipc2221Width(current_a, 1)
  const w2oz = ipc2221Width(current_a, 2)
  return {
    net,
    current_a,
    min_width_mm:     Math.max(0.2, Math.round(w1oz * 100) / 100),
    min_width_mm_2oz: Math.max(0.2, Math.round(w2oz * 100) / 100),
    copper_weight_oz: w1oz > 4 ? 2 : 1,
  }
}

/** Build IPC-2221 trace-width entries for every power net in the design. */
export function computeTraceWidths(topology: TopologyId, spec: DesignSpec, result: DesignResult): TraceWidth[] {
  const iIn         = (spec.vout * spec.iout) / (spec.vinMin * spec.efficiency)
  const iSwitchPeak = result.peakCurrent
  const iGate       = 2.0  // A — typical driver peak (same assumption as gate-drive.ts)

  const widths: TraceWidth[] = [
    makeTrace('Vin power',    iIn),
    makeTrace('Switch node',  iSwitchPeak),
    makeTrace('Output power', spec.iout),
    makeTrace('GND return',   Math.max(iIn, spec.iout)),
    makeTrace('Gate drive',   iGate),
  ]

  if (topology === 'flyback' || topology === 'forward') {
    widths.push(makeTrace('Primary winding return',   iIn))
    widths.push(makeTrace('Secondary winding return', spec.iout / (result.turnsRatio ?? 1) * 1.2))
  }

  return widths
}
