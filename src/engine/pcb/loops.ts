// Critical-current-loop catalogue, indexed by topology.
// Each loop is a fixed data record — no logic, no branching.

import type { TopologyId } from '../../store/workbenchStore'
import type { CriticalLoop } from './types'

const GATE_DRIVE_LOOP: CriticalLoop = {
  name: 'Gate drive loop',
  components: ['Gate driver', 'Rg', 'Q1 (G–S)', 'Gate driver return'],
  description:
    'Fast current transient (ns) that controls turn-on/turn-off speed. ' +
    'Keep loop area tiny to prevent gate-source ringing that causes false triggering.',
  priority: 1,
}

const LOOPS: Record<TopologyId, CriticalLoop[]> = {
  buck: [
    {
      name: 'Input switching loop',
      components: ['Cin', 'Q1 (D–S)', 'D1', 'Cin (return)'],
      description:
        'High di/dt loop: current snaps from 0 to Iin every switch cycle. ' +
        'Enclose the minimum copper area to limit stray inductance and voltage overshoot. ' +
        'This loop drives both conducted and radiated EMI.',
      priority: 1,
    },
    {
      name: 'Output filter loop',
      components: ['Q1/D1 junction', 'L', 'Cout', 'GND return'],
      description:
        'Continuous current loop through the inductor and output capacitor. ' +
        'Lower di/dt than the switching loop, but still carries full load current.',
      priority: 2,
    },
    GATE_DRIVE_LOOP,
    {
      name: 'Feedback sense path',
      components: ['Vout node', 'R_upper', 'R_lower', 'COMP pin', 'GND ref'],
      description:
        'Carries µA-level signal. Any noise coupled from the switch node causes ' +
        'output ripple on the regulation point. Route away from L and Q1.',
      priority: 2,
    },
  ],
  boost: [
    {
      name: 'Output switching loop',
      components: ['L (drain end)', 'D1', 'Cout', 'Q1 (D–S)', 'L return'],
      description:
        'High di/dt: diode current snaps from Iout to 0 at turn-on and reverses at turn-off. ' +
        'Minimize this loop area — it is the dominant EMI source in a boost.',
      priority: 1,
    },
    {
      name: 'Input inductor loop',
      components: ['Cin', 'L', 'Q1 (D–S)', 'Cin return'],
      description:
        'Continuous current through the inductor. Less critical than the output loop ' +
        'but still drives conduction-mode input ripple.',
      priority: 2,
    },
    GATE_DRIVE_LOOP,
  ],
  'buck-boost': [
    {
      name: 'Switch node loop',
      components: ['Q1 (D–S)', 'L', 'D1', 'Q1 return'],
      description: 'Current snaps to 0 through the diode every cycle. This is the primary EMI source; minimize area.',
      priority: 1,
    },
    {
      name: 'Input capacitor loop',
      components: ['Cin', 'Q1 (D)', 'L', 'Cin return'],
      description: 'Pulsed input current drawn from Cin each switch cycle.',
      priority: 2,
    },
    {
      name: 'Output capacitor loop',
      components: ['D1', 'Cout (−)', 'Load', 'Cout (+)'],
      description: 'Inverted output polarity: ensure correct orientation and ground reference.',
      priority: 2,
    },
    GATE_DRIVE_LOOP,
  ],
  flyback: [
    {
      name: 'Primary switching loop',
      components: ['Cin', 'T1 (primary)', 'Q1 (D–S)', 'Cin return'],
      description:
        'Primary current builds during Q1 on-time; snaps to zero at turn-off. ' +
        'High dI/dt at turn-off is the dominant conducted EMI source on the primary side.',
      priority: 1,
    },
    {
      name: 'Secondary rectifier loop',
      components: ['T1 (secondary)', 'D1', 'Cout', 'T1 secondary return'],
      description:
        'Secondary current pulse during Q1 off-time. Diode reverse recovery ' +
        'causes ringing — keep this loop small and add a small R-C snubber.',
      priority: 1,
    },
    {
      name: 'Primary clamp loop',
      components: ['T1 (primary)', 'RCD clamp', 'Q1 (D)'],
      description:
        'Clamps the leakage inductance voltage spike at Q1 turn-off. ' +
        'Place the clamp components close to the MOSFET drain.',
      priority: 2,
    },
    GATE_DRIVE_LOOP,
  ],
  forward: [
    {
      name: 'Primary switching loop',
      components: ['Cin', 'T1 (primary)', 'Q1 (D–S)', 'Cin return'],
      description:
        'Same pattern as flyback primary: high di/dt at turn-off. ' +
        'Minimize area. Reset winding adds a second current path during off-time.',
      priority: 1,
    },
    {
      name: 'Secondary rectifier loop',
      components: ['T1 (secondary)', 'D1 (forward)', 'Lo', 'Cout', 'D2 (freewheel)', 'T1 return'],
      description:
        'Forward rectifier conducts during on-time; freewheel diode during off-time. ' +
        'Both rectifier diodes must be close to the secondary winding terminal.',
      priority: 1,
    },
    {
      name: 'Output inductor loop',
      components: ['D1/D2 junction', 'Lo', 'Cout'],
      description: 'Continuous current path — lower di/dt. Still carries full Iout.',
      priority: 2,
    },
    GATE_DRIVE_LOOP,
  ],
  sepic: [
    {
      name: 'Switch node loop',
      components: ['Q1 (D–S)', 'L2', 'D1', 'Q1 return'],
      description:
        'Current through D1 snaps to zero at Q1 turn-on. ' +
        'Minimize area to limit ringing at the switch node (L1/Cc/L2 junction).',
      priority: 1,
    },
    {
      name: 'Coupling capacitor loop',
      components: ['Cc', 'L2', 'Q1 (D–S)', 'Cc return via L1'],
      description:
        'AC current through Cc and L2 during Q1 on-time. ' +
        'Place Cc between L1 and L2 on the board for shortest current path.',
      priority: 2,
    },
    {
      name: 'Input inductor loop',
      components: ['Cin', 'L1', 'Q1 (D)', 'Cin return'],
      description: 'Continuous input current; lower di/dt than the switch node loop.',
      priority: 2,
    },
    GATE_DRIVE_LOOP,
  ],
}

/** Look up critical-current loops for a topology. */
export function loopsForTopology(topology: TopologyId): CriticalLoop[] {
  return LOOPS[topology]
}
