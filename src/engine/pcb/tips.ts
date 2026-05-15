// Topology-specific layout tips, plus universal best practices.

import type { DesignSpec } from '../types'
import type { TopologyId } from '../../store/workbenchStore'

const COMMON_TIPS: string[] = [
  'Star-point ground: join power GND, signal GND, and chassis GND at one low-impedance point near the input bulk capacitor.',
  'Use a solid power GND plane on an inner layer; never cut it under the switching loop.',
  'Place 100 nF ceramic bypass capacitors on every IC supply pin, as close as possible to the pin.',
  'Add test points on the switch node, output voltage, and gate signal for bench debug.',
  'Thermal relief spokes on pad connections to ground plane impede heat dissipation — use solid connections for power pads.',
]

function isolationCreepageTip(vinMax: number): string {
  const mm = Math.max(6.4, vinMax / 250 * 6.4).toFixed(1)
  return `Creepage/clearance: with Vin_max = ${vinMax} V, IEC 62368-1 requires ≥ ${mm} mm creepage on the PCB slot.`
}

function buckSkinDepthTip(fsw: number): string {
  const skin_um = (66 / Math.sqrt(fsw / 1e6)).toFixed(0)
  return `At ${(fsw / 1e6).toFixed(2)} MHz the skin depth in copper is ${skin_um} µm; use ≥ 2 oz copper for high-current power traces.`
}

function buckTips(spec: DesignSpec): string[] {
  return [
    'Keep the switch node copper area (Q1 drain, D1 cathode, L pin) as small as possible — it is the primary radiator of EMI.',
    'Route the bootstrap cap (if used) directly between the SW pin and VCC of the driver IC; the loop must be < 0.5 cm².',
    'Avoid vias in the switch node — they add inductance that worsens switching transients.',
    buckSkinDepthTip(spec.fsw),
  ]
}

const BOOST_TIPS: string[] = [
  'The output diode anode is the fastest-switching node — treat it with the same care as a buck switch node.',
  'Route the inductor between Cin and the switch node; avoid routing other signals underneath L.',
  'Boost converters have a right-half-plane zero (RHPZ); the control loop is sluggish during large load steps — keep Cout ESR low.',
  'Do not place vias in the high-current input trace (L → Q1); trace inductance adds to the switch-node ringing.',
]

const BUCK_BOOST_TIPS: string[] = [
  'The output rail is inverted — clearly mark polarity on the silk screen and assembly drawing.',
  'Both the input current (through L and Q1) and the output current (through D1) are pulsed; budget copper area accordingly.',
  'Keep the Cin return and Cout (−) terminal close to Q1 source to avoid ground bounce on the switch.',
]

function flybackTips(spec: DesignSpec): string[] {
  return [
    'Route primary and secondary ground planes separately; join them at exactly one point (typically at the output connector GND pin).',
    'The transformer primary and secondary guard traces (copper fills tied to their respective GND planes) reduce common-mode coupling through the transformer interwinding capacitance.',
    'Place the RCD clamp within 5 mm of Q1 drain and T1 pin 1 — long traces add inductance and increase the clamp voltage spike.',
    'The secondary diode undergoes hard recovery at Q1 turn-on; add a small RC snubber (10 Ω + 1 nF) across D1 to damp ringing.',
    isolationCreepageTip(spec.vinMax),
  ]
}

function forwardTips(spec: DesignSpec): string[] {
  return [
    'Reset winding occupies the same bobbin as the primary; keep its trace routing symmetric to minimise leakage inductance.',
    'Both D1 and D2 carry pulsed current; mount them on the same heat spreader pad if possible.',
    'The output inductor Lo is on the secondary side — route it between the rectifier output and Cout using a solid 2 oz power pour.',
    'Route primary and secondary grounds separately; single-point connection at the secondary output connector.',
    isolationCreepageTip(spec.vinMax),
  ]
}

const SEPIC_TIPS: string[] = [
  'L1 and L2 can be wound on a single coupled inductor core — this improves efficiency and reduces PCB area, but increases component cost.',
  'The coupling capacitor Cc carries the full AC current; use a low-ESR film or MLCC type; mount it centrally between L1 and L2.',
  'SEPIC output is positive and can be above or below Vin — double-check power-up sequencing if other rails depend on Vout.',
  'The switch node (Q1 drain) swings from GND to Vin + Vout; size copper clearance accordingly.',
]

const TOPO_TIPS: Record<TopologyId, (spec: DesignSpec) => string[]> = {
  buck:         buckTips,
  boost:        () => BOOST_TIPS,
  'buck-boost': () => BUCK_BOOST_TIPS,
  flyback:      flybackTips,
  forward:      forwardTips,
  sepic:        () => SEPIC_TIPS,
}

/** Concatenates topology-specific tips followed by the universal best-practice list. */
export function tipsForTopology(topology: TopologyId, spec: DesignSpec): string[] {
  return [...TOPO_TIPS[topology](spec), ...COMMON_TIPS]
}
