// Keep-out areas: where high-impedance / sensitive signals must NOT be routed.

import type { DesignSpec } from '../types'
import type { TopologyId } from '../../store/workbenchStore'
import type { KeepOut } from './types'

function switchNodeKeepOut(vinMax: number): KeepOut {
  return {
    area: 'Switch node copper polygon',
    reason:
      'High dV/dt (can exceed ' + Math.round(vinMax / 20) + ' V/ns). ' +
      'Any sensitive trace (feedback, enable, PG) picks up capacitively coupled noise. ' +
      'Keep polygon area small and keep it away from sensitive signals.',
  }
}

const GATE_NEAR_MAGNETICS: KeepOut = {
  area: 'Gate drive traces near magnetics',
  reason:
    'Inductor fringe fields can couple into gate traces and alter switching behaviour. ' +
    'Keep gate Rg traces on the opposite side or well away from the inductor body.',
}

const FEEDBACK_DIVIDER: KeepOut = {
  area: 'Feedback resistor divider',
  reason:
    'Route on an inner layer or with a ground guard ring if near the switch node. ' +
    'Even a few mV of coupled noise on the feedback node causes measurable output ripple.',
}

const ISOLATION_BOUNDARY: KeepOut = {
  area: 'Primary–secondary isolation boundary',
  reason:
    'IEC 62368-1 requires ≥ 6.4 mm creepage and ≥ 4.0 mm clearance between primary ' +
    'and secondary circuits for reinforced insulation. Mark a keep-out slot or gap on the PCB.',
}

const DIODE_ANODE_HV: KeepOut = {
  area: 'Diode anode node (switch node side)',
  reason:
    'In boost/SEPIC the switch node is at the diode anode and can swing to Vout or higher. ' +
    'Keep sensitive traces 3 mm clear of this node.',
}

/** Topology-specific keep-out areas plus the three universal ones. */
export function keepOutsForTopology(topology: TopologyId, spec: DesignSpec): KeepOut[] {
  const out: KeepOut[] = [switchNodeKeepOut(spec.vinMax), GATE_NEAR_MAGNETICS, FEEDBACK_DIVIDER]
  if (topology === 'flyback' || topology === 'forward') out.push(ISOLATION_BOUNDARY)
  if (topology === 'boost'   || topology === 'sepic')   out.push(DIODE_ANODE_HV)
  return out
}
