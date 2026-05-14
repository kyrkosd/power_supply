// Placement-order recipe per topology — a numbered checklist for the layout engineer.

import type { TopologyId } from '../../store/workbenchStore'
import type { PlacementStep } from './types'

const STEP1: PlacementStep = {
  step: 1,
  component: 'Controller IC / gate driver',
  reason: 'Anchors the design; all other components reference its pin locations.',
}

const STEPS: Record<TopologyId, PlacementStep[]> = {
  buck: [
    { step: 2, component: 'Q1 (high-side MOSFET)', reason: 'Defines the switch node; source connects to the most critical loop node.' },
    { step: 3, component: 'D1 (freewheel diode) or synchronous FET', reason: 'Cathode/drain must land directly on Q1 source to close the switching loop.' },
    { step: 4, component: 'Cin (input capacitor)', reason: 'Drain of Q1 and cathode return of D1 must reach Cin with the shortest path.' },
    { step: 5, component: 'L (inductor)', reason: 'Place on switch node; connects to Cout and the load.' },
    { step: 6, component: 'Cout (output capacitor)', reason: 'Positive terminal at inductor output node; negative to power GND.' },
    { step: 7, component: 'Feedback resistor divider', reason: 'Route from Cout positive terminal; keep away from switch node and inductor.' },
  ],
  boost: [
    { step: 2, component: 'Q1 (low-side MOSFET)', reason: 'Source tied to power GND; drain is the high-di/dt switch node.' },
    { step: 3, component: 'D1 (boost diode)', reason: 'Anode must land directly on Q1 drain — the fastest node in the circuit.' },
    { step: 4, component: 'Cout (output capacitor)', reason: 'Cathode of D1 to Cout is the output loop; keep it short.' },
    { step: 5, component: 'L (inductor)', reason: 'Connects Vin to Q1 drain; continuous current, less critical than output loop.' },
    { step: 6, component: 'Cin (input capacitor)', reason: 'Bypass at Vin input; near L input terminal.' },
    { step: 7, component: 'Feedback resistor divider', reason: 'Route from Cout; avoid inductor and switch node.' },
  ],
  'buck-boost': [
    { step: 2, component: 'Q1 (MOSFET)', reason: 'Low-side switch; source to GND, drain to the switch node.' },
    { step: 3, component: 'D1 (output diode)', reason: 'Anode directly on Q1 drain; cathode to the inverted output.' },
    { step: 4, component: 'L (inductor)', reason: 'Between Vin and Q1 drain; carries full peak current.' },
    { step: 5, component: 'Cout (output capacitor)', reason: 'Note inverted polarity (−) rail; short path from D1 cathode.' },
    { step: 6, component: 'Cin (input capacitor)', reason: 'Bypass at Vin; near L input terminal.' },
    { step: 7, component: 'Feedback resistor divider', reason: 'Sense the inverted output rail; route away from switch node.' },
  ],
  flyback: [
    { step: 2, component: 'Q1 (primary MOSFET)', reason: 'Source to primary GND; drain connects to T1 primary and clamp.' },
    { step: 3, component: 'T1 (transformer)', reason: 'Primary terminal nearest Q1 drain; secondary terminal nearest D1.' },
    { step: 4, component: 'RCD clamp (R, C, D across primary)', reason: 'Must be directly at Q1 drain and T1 primary; limits leakage spike.' },
    { step: 5, component: 'Cin (primary bulk capacitor)', reason: 'Between HV bus and primary GND; close to T1 primary.' },
    { step: 6, component: 'D1 (secondary rectifier)', reason: 'Anode directly on T1 secondary terminal; short lead to Cout.' },
    { step: 7, component: 'Cout (secondary output capacitor)', reason: 'Cathode of D1 to Cout; forms the secondary rectifier loop.' },
    { step: 8, component: 'Feedback optocoupler / TL431', reason: 'Route from secondary Vout; keep secondary GND separate from primary GND until the single-point star connection.' },
  ],
  forward: [
    { step: 2, component: 'Q1 (primary MOSFET)', reason: 'Source to primary GND; drain to T1 primary.' },
    { step: 3, component: 'T1 (transformer)', reason: 'Primary terminal nearest Q1 drain; reset winding on same bobbin section.' },
    { step: 4, component: 'Cin (primary bulk capacitor)', reason: 'Close to T1 primary, between HV bus and primary GND.' },
    { step: 5, component: 'D1 + D2 (secondary rectifiers)', reason: 'Both anodes directly on T1 secondary terminals; cathodes toward Lo.' },
    { step: 6, component: 'Lo (output inductor)', reason: 'Between rectifier junction and Cout; carries continuous Iout.' },
    { step: 7, component: 'Cout (output capacitor)', reason: 'At Lo output; close the output filter loop.' },
    { step: 8, component: 'Feedback network', reason: 'Sense at Cout; use separate ground trace back to secondary GND.' },
  ],
  sepic: [
    { step: 2, component: 'Q1 (MOSFET)', reason: 'Low-side switch; source to GND; drain is the switch node for L2 and Cc.' },
    { step: 3, component: 'D1 (output diode)', reason: 'Anode on Q1 drain / L2 junction; cathode to Cout.' },
    { step: 4, component: 'L2 (output inductor)', reason: 'Between Cc and Q1 drain/D1; place close to Q1.' },
    { step: 5, component: 'Cc (coupling capacitor)', reason: 'Between L1 and L2; place centrally between them.' },
    { step: 6, component: 'L1 (input inductor)', reason: 'Between Vin and Cc; continuous input current.' },
    { step: 7, component: 'Cin (input capacitor)', reason: 'Bypass at Vin near L1 input.' },
    { step: 8, component: 'Cout (output capacitor)', reason: 'At D1 cathode; short path to load and feedback.' },
    { step: 9, component: 'Feedback resistor divider', reason: 'Sense at Cout; route away from switch node.' },
  ],
}

/** Placement steps prepended with the universal Step 1 (controller IC). */
export function placementForTopology(topology: TopologyId): PlacementStep[] {
  return [STEP1, ...STEPS[topology]]
}
