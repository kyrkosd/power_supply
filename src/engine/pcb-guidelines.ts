// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
/**
 * PCB layout guidance generator.
 * Pure engine module — no React, no DOM, no Zustand.
 *
 * Generates layout guidelines from a computed design result.
 * All physical quantities are in SI base units internally.
 */

import type { DesignSpec, DesignResult } from './types'
import type { TopologyId } from '../store/workbenchStore'

// ── Public types ──────────────────────────────────────────────────────────────

export interface CriticalLoop {
  name: string
  components: string[]
  description: string
  priority: 1 | 2 | 3   // 1 = critical, 2 = important, 3 = nice-to-have
}

export interface TraceWidth {
  net: string
  current_a: number
  min_width_mm: number        // at 1 oz copper, 10 °C rise
  min_width_mm_2oz: number    // at 2 oz copper, 10 °C rise
  copper_weight_oz: 1 | 2     // recommended copper weight
}

export interface PlacementStep {
  step: number
  component: string
  reason: string
}

export interface ThermalVia {
  component: string
  via_count: number
  via_diameter_mm: number
  reason: string
}

export interface KeepOut {
  area: string
  reason: string
}

export interface LayoutGuidelines {
  critical_loops: CriticalLoop[]
  trace_widths: TraceWidth[]
  placement_order: PlacementStep[]
  thermal_vias: ThermalVia[]
  keep_outs: KeepOut[]
  general_tips: string[]
}

// ── IPC-2221 trace width calculation ─────────────────────────────────────────

// IPC-2221 Table 6.2 — external layer coefficients (k, b, c)
// W [mils] = I / (k × ΔT^b)^(1/c) / thickness [mils]
// Then convert to mm.  1 oz copper ≈ 1.378 mils thick; 2 oz ≈ 2.756 mils.
const IPC2221_K = 0.048
const IPC2221_B = 0.44
const IPC2221_C = 0.725
const DELTA_T   = 10    // °C temperature rise
const MILS_PER_MM = 39.3701

function ipc2221Width(current_a: number, thickness_oz: 1 | 2): number {
  const thicknessMils = thickness_oz === 1 ? 1.378 : 2.756
  // IPC-2221 eq: I = k × ΔT^b × (A)^c   where A = cross-section area [mils²]
  // Solve for A, then width = A / thickness
  const areaMils2 = (current_a / (IPC2221_K * Math.pow(DELTA_T, IPC2221_B))) ** (1 / IPC2221_C)
  const widthMils = areaMils2 / thicknessMils
  return widthMils / MILS_PER_MM  // mm
}

function makeTrace(net: string, current_a: number): TraceWidth {
  const w1oz = ipc2221Width(current_a, 1)
  const w2oz = ipc2221Width(current_a, 2)
  // Recommend 2 oz when minimum width at 1 oz would be impractically wide (> 4 mm)
  const copper_weight_oz: 1 | 2 = w1oz > 4 ? 2 : 1
  return {
    net,
    current_a,
    min_width_mm: Math.max(0.2, Math.round(w1oz * 100) / 100),
    min_width_mm_2oz: Math.max(0.2, Math.round(w2oz * 100) / 100),
    copper_weight_oz,
  }
}

// ── Thermal via recommendation ────────────────────────────────────────────────

// Rule of thumb: 1 thermal via (ø0.3 mm) ≈ 0.2 W thermal conductance through FR4
const WATTS_PER_VIA = 0.2
const VIA_DIAM_MM   = 0.3

function thermalVia(component: string, plossW: number, reason: string): ThermalVia | null {
  if (plossW < 0.5) return null
  return {
    component,
    via_count: Math.ceil(plossW / WATTS_PER_VIA),
    via_diameter_mm: VIA_DIAM_MM,
    reason,
  }
}

// ── Critical loop definitions per topology ────────────────────────────────────

function buckLoops(): CriticalLoop[] {
  return [
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
    {
      name: 'Gate drive loop',
      components: ['Gate driver', 'Rg', 'Q1 (G–S)', 'Gate driver return'],
      description:
        'Fast current transient (ns) that controls turn-on/turn-off speed. ' +
        'Keep loop area tiny to prevent gate-source ringing that causes false triggering.',
      priority: 1,
    },
    {
      name: 'Feedback sense path',
      components: ['Vout node', 'R_upper', 'R_lower', 'COMP pin', 'GND ref'],
      description:
        'Carries µA-level signal. Any noise coupled from the switch node causes ' +
        'output ripple on the regulation point. Route away from L and Q1.',
      priority: 2,
    },
  ]
}

function boostLoops(): CriticalLoop[] {
  return [
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
    {
      name: 'Gate drive loop',
      components: ['Gate driver', 'Rg', 'Q1 (G–S)', 'Gate driver return'],
      description:
        'Fast transient. Keep gate-source loop < 1 cm² to prevent ringing.',
      priority: 1,
    },
  ]
}

function buckBoostLoops(): CriticalLoop[] {
  return [
    {
      name: 'Switch node loop',
      components: ['Q1 (D–S)', 'L', 'D1', 'Q1 return'],
      description:
        'Current snaps to 0 through the diode every cycle. ' +
        'This is the primary EMI source; minimize area.',
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
    {
      name: 'Gate drive loop',
      components: ['Gate driver', 'Rg', 'Q1 (G–S)', 'Gate driver return'],
      priority: 1,
      description: 'Fast transient. Keep gate-source loop < 1 cm².',
    },
  ]
}

function flybackLoops(): CriticalLoop[] {
  return [
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
    {
      name: 'Gate drive loop',
      components: ['Gate driver', 'Rg', 'Q1 (G–S)', 'Gate driver return'],
      priority: 1,
      description: 'Fast transient. Route directly from driver IC to gate pin.',
    },
  ]
}

function forwardLoops(): CriticalLoop[] {
  return [
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
    {
      name: 'Gate drive loop',
      components: ['Gate driver', 'Rg', 'Q1 (G–S)', 'Gate driver return'],
      priority: 1,
      description: 'Fast transient. Keep gate-source loop < 1 cm².',
    },
  ]
}

function sepicLoops(): CriticalLoop[] {
  return [
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
    {
      name: 'Gate drive loop',
      components: ['Gate driver', 'Rg', 'Q1 (G–S)', 'Gate driver return'],
      priority: 1,
      description: 'Low-side gate drive. Keep gate-source loop < 1 cm².',
    },
  ]
}

function loopsForTopology(topology: TopologyId): CriticalLoop[] {
  switch (topology) {
    case 'buck':      return buckLoops()
    case 'boost':     return boostLoops()
    case 'buck-boost': return buckBoostLoops()
    case 'flyback':   return flybackLoops()
    case 'forward':   return forwardLoops()
    case 'sepic':     return sepicLoops()
  }
}

// ── Placement order ───────────────────────────────────────────────────────────

function placementForTopology(topology: TopologyId): PlacementStep[] {
  const shared: PlacementStep[] = [
    { step: 1, component: 'Controller IC / gate driver', reason: 'Anchors the design; all other components reference its pin locations.' },
  ]

  const topologySpecific: Record<TopologyId, PlacementStep[]> = {
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

  return [
    ...shared,
    ...topologySpecific[topology],
  ]
}

// ── Keep-out areas ────────────────────────────────────────────────────────────

function keepOutsForTopology(topology: TopologyId, spec: DesignSpec): KeepOut[] {
  const common: KeepOut[] = [
    {
      area: 'Switch node copper polygon',
      reason:
        'High dV/dt (can exceed ' + Math.round(spec.vinMax / 20) + ' V/ns). ' +
        'Any sensitive trace (feedback, enable, PG) picks up capacitively coupled noise. ' +
        'Keep polygon area small and keep it away from sensitive signals.',
    },
    {
      area: 'Gate drive traces near magnetics',
      reason:
        'Inductor fringe fields can couple into gate traces and alter switching behaviour. ' +
        'Keep gate Rg traces on the opposite side or well away from the inductor body.',
    },
    {
      area: 'Feedback resistor divider',
      reason:
        'Route on an inner layer or with a ground guard ring if near the switch node. ' +
        'Even a few mV of coupled noise on the feedback node causes measurable output ripple.',
    },
  ]

  if (topology === 'flyback' || topology === 'forward') {
    common.push({
      area: 'Primary–secondary isolation boundary',
      reason:
        'IEC 62368-1 requires ≥ 6.4 mm creepage and ≥ 4.0 mm clearance between primary ' +
        'and secondary circuits for reinforced insulation. Mark a keep-out slot or gap on the PCB.',
    })
  }

  if (topology === 'boost' || topology === 'sepic') {
    common.push({
      area: 'Diode anode node (switch node side)',
      reason:
        'In boost/SEPIC the switch node is at the diode anode and can swing to Vout or higher. ' +
        'Keep sensitive traces 3 mm clear of this node.',
    })
  }

  return common
}

// ── General topology-specific tips ───────────────────────────────────────────

function tipsForTopology(topology: TopologyId, spec: DesignSpec): string[] {
  const common = [
    'Star-point ground: join power GND, signal GND, and chassis GND at one low-impedance point near the input bulk capacitor.',
    'Use a solid power GND plane on an inner layer; never cut it under the switching loop.',
    'Place 100 nF ceramic bypass capacitors on every IC supply pin, as close as possible to the pin.',
    'Add test points on the switch node, output voltage, and gate signal for bench debug.',
    'Thermal relief spokes on pad connections to ground plane impede heat dissipation — use solid connections for power pads.',
  ]

  const specific: Record<TopologyId, string[]> = {
    buck: [
      'Keep the switch node copper area (Q1 drain, D1 cathode, L pin) as small as possible — it is the primary radiator of EMI.',
      'Route the bootstrap cap (if used) directly between the SW pin and VCC of the driver IC; the loop must be < 0.5 cm².',
      'Avoid vias in the switch node — they add inductance that worsens switching transients.',
      `At ${(spec.fsw / 1e6).toFixed(2)} MHz the skin depth in copper is ${(66 / Math.sqrt(spec.fsw / 1e6)).toFixed(0)} µm; use ≥ 2 oz copper for high-current power traces.`,
    ],
    boost: [
      'The output diode anode is the fastest-switching node — treat it with the same care as a buck switch node.',
      'Route the inductor between Cin and the switch node; avoid routing other signals underneath L.',
      'Boost converters have a right-half-plane zero (RHPZ); the control loop is sluggish during large load steps — keep Cout ESR low.',
      'Do not place vias in the high-current input trace (L → Q1); trace inductance adds to the switch-node ringing.',
    ],
    'buck-boost': [
      'The output rail is inverted — clearly mark polarity on the silk screen and assembly drawing.',
      'Both the input current (through L and Q1) and the output current (through D1) are pulsed; budget copper area accordingly.',
      'Keep the Cin return and Cout (−) terminal close to Q1 source to avoid ground bounce on the switch.',
    ],
    flyback: [
      'Route primary and secondary ground planes separately; join them at exactly one point (typically at the output connector GND pin).',
      'The transformer primary and secondary guard traces (copper fills tied to their respective GND planes) reduce common-mode coupling through the transformer interwinding capacitance.',
      'Place the RCD clamp within 5 mm of Q1 drain and T1 pin 1 — long traces add inductance and increase the clamp voltage spike.',
      'The secondary diode undergoes hard recovery at Q1 turn-on; add a small RC snubber (10 Ω + 1 nF) across D1 to damp ringing.',
      `Creepage/clearance: with Vin_max = ${spec.vinMax} V, IEC 62368-1 requires ≥ ${Math.max(6.4, spec.vinMax / 250 * 6.4).toFixed(1)} mm creepage on the PCB slot.`,
    ],
    forward: [
      'Reset winding occupies the same bobbin as the primary; keep its trace routing symmetric to minimise leakage inductance.',
      'Both D1 and D2 carry pulsed current; mount them on the same heat spreader pad if possible.',
      'The output inductor Lo is on the secondary side — route it between the rectifier output and Cout using a solid 2 oz power pour.',
      'Route primary and secondary grounds separately; single-point connection at the secondary output connector.',
      `Creepage/clearance: Vin_max = ${spec.vinMax} V; maintain ≥ ${Math.max(6.4, spec.vinMax / 250 * 6.4).toFixed(1)} mm across the isolation boundary.`,
    ],
    sepic: [
      'L1 and L2 can be wound on a single coupled inductor core — this improves efficiency and reduces PCB area, but increases component cost.',
      'The coupling capacitor Cc carries the full AC current; use a low-ESR film or MLCC type; mount it centrally between L1 and L2.',
      'SEPIC output is positive and can be above or below Vin — double-check power-up sequencing if other rails depend on Vout.',
      'The switch node (Q1 drain) swings from GND to Vin + Vout; size copper clearance accordingly.',
    ],
  }

  return [...specific[topology], ...common]
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateLayoutGuidelines(
  topology: TopologyId,
  spec: DesignSpec,
  result: DesignResult,
): LayoutGuidelines {
  // ── Current magnitudes for trace-width calculations ───────────────────────
  const iIn      = (spec.vout * spec.iout) / (spec.vinMin * spec.efficiency)
  const iSwitchPeak = result.peakCurrent
  const iOut     = spec.iout
  const iGate    = 2.0   // A — typical driver peak (same assumption as gate-drive.ts)

  const trace_widths: TraceWidth[] = [
    makeTrace('Vin power', iIn),
    makeTrace('Switch node', iSwitchPeak),
    makeTrace('Output power', iOut),
    makeTrace('GND return', Math.max(iIn, iOut)),
    makeTrace('Gate drive', iGate),
  ]

  // Flyback and forward: also size primary and secondary separately
  if (topology === 'flyback' || topology === 'forward') {
    const iPrimary = iIn
    const iSecondary = iOut / (result.turnsRatio ?? 1) * 1.2  // with 20 % margin
    trace_widths.push(makeTrace('Primary winding return', iPrimary))
    trace_widths.push(makeTrace('Secondary winding return', iSecondary))
  }

  // ── Thermal vias ──────────────────────────────────────────────────────────
  const losses = result.losses
  const thermal_vias: ThermalVia[] = []

  if (losses) {
    // Handle both loss structures: 9-component (buck/boost/buckBoost/sepic) and simplified (flyback/forward)
    const mosfetLoss = (losses as any).mosfet ?? ((losses as any).mosfet_conduction + (losses as any).mosfet_switching)
    const diodeLoss = (losses as any).diode ?? (losses as any).diode_conduction
    const coreLoss = (losses as any).core ?? (losses as any).inductor_core

    if (mosfetLoss > 0.1) {
      const mosfetVia = thermalVia('Q1 (MOSFET)', mosfetLoss, `${mosfetLoss.toFixed(1)} W conduction + switching losses`)
      if (mosfetVia) thermal_vias.push(mosfetVia)
    }

    if (diodeLoss > 0.1) {
      const diodeVia = thermalVia('D1 (output diode)', diodeLoss, `${diodeLoss.toFixed(1)} W forward-conduction losses`)
      if (diodeVia) thermal_vias.push(diodeVia)
    }

    if ((topology === 'flyback' || topology === 'forward') && coreLoss > 0.5) {
      thermal_vias.push({
        component: 'T1 (transformer)',
        via_count: Math.ceil(coreLoss / WATTS_PER_VIA),
        via_diameter_mm: VIA_DIAM_MM,
        reason: `${coreLoss.toFixed(1)} W core loss; use a copper pour under the core mounting pads.`,
      })
    }
  }

  return {
    critical_loops:  loopsForTopology(topology),
    trace_widths,
    placement_order: placementForTopology(topology),
    thermal_vias,
    keep_outs:       keepOutsForTopology(topology, spec),
    general_tips:    tipsForTopology(topology, spec),
  }
}
