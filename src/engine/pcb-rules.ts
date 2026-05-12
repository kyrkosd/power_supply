// PCB trace width and thermal design rules per IPC-2221 standard.

export interface TraceWidthResult {
  width_mm: number
  width_mils: number
}

export interface CriticalLoopInfo {
  description: string
  components: string[]
  placementOrder: string[]
}

/**
 * Minimum trace width per IPC-2221 standard.
 * Area [mils²] = (I / (k × ΔT^b))^(1/c), then width = area / thickness.
 *
 * @param current_A    RMS current in Amperes
 * @param tempRise_C   Allowed temperature rise (default 20 °C)
 * @param thickness_oz Copper thickness in oz (default 1)
 * @param isInternal   Internal layer uses k = 0.024; external k = 0.048
 */
export function calculateTraceWidth(
  current_A: number,
  tempRise_C = 20,
  thickness_oz = 1,
  isInternal = false,
): TraceWidthResult {
  const k          = isInternal ? 0.024 : 0.048
  const area_mils2 = Math.pow(current_A / (k * Math.pow(tempRise_C, 0.44)), 1 / 0.725)
  const width_mils = area_mils2 / (thickness_oz * 1.378)
  return { width_mils, width_mm: width_mils * 0.0254 }
}

/**
 * Critical high-di/dt loop description and component placement rules for a given topology.
 * Identifies the most EMI-critical current loop and optimal component ordering.
 */
export function getCriticalLoop(topology: 'buck' | 'boost' | 'flyback' | string): CriticalLoopInfo {
  switch (topology.toLowerCase()) {
    case 'buck':
      return {
        description: 'High di/dt input loop containing the input capacitor, high-side switch, and low-side diode/switch. This loop must be minimized to reduce EMI and ringing.',
        components: ['Cin', 'Q_high', 'D_low (or Q_low)'],
        placementOrder: [
          '1. Place Cin Kelvin-close to Q_high Drain and D_low Anode (or Q_low Source)',
          '2. Keep SW node (Q_high Source) extremely short and wide',
          '3. Place Inductor close to SW node',
          '4. Place Cout close to Inductor',
        ],
      }
    case 'boost':
      return {
        description: 'High di/dt output loop containing the low-side switch, output diode, and output capacitor.',
        components: ['Q_low', 'D_out', 'Cout'],
        placementOrder: [
          '1. Place Cout Kelvin-close to D_out Cathode and Q_low Source',
          '2. Keep SW node (Inductor to Q_low/D_out) extremely short',
          '3. Place Cin close to Inductor',
          '4. Route Feedback network near control IC, far from SW node',
        ],
      }
    case 'flyback':
      return {
        description: 'High di/dt primary loop (Cin, Q_main, Transformer Primary) and secondary loop (Transformer Secondary, D_out, Cout).',
        components: ['Cin', 'Q_main', 'T1_Pri', 'D_out', 'Cout', 'T1_Sec'],
        placementOrder: [
          '1. Tightly group Cin, Q_main, and T1_Pri',
          '2. Place Clamp circuit tightly coupled to T1_Pri',
          '3. Tightly group T1_Sec, D_out, and Cout',
          '4. Place Y-cap bridging primary/secondary grounds directly under transformer',
        ],
      }
    default:
      return {
        description: 'General high di/dt switching loop.',
        components: ['Switch', 'Diode', 'Capacitor'],
        placementOrder: [
          '1. Minimize high di/dt loop area',
          '2. Short SW node',
          '3. Keep feedback away from noisy nodes',
        ],
      }
  }
}

/**
 * Estimate copper pour area (mm²) needed to dissipate heat from a power device.
 * Heuristic: Rth_ca ≈ 50 / √(Area_in²), targeting a given max junction temperature.
 *
 * @param pLoss_W       Power loss in watts
 * @param maxTemp_C     Maximum allowed junction temperature (default 100 °C)
 * @param ambientTemp_C Ambient temperature (default 25 °C)
 * @returns Required copper pour area in mm², or 0 if standard package is sufficient
 */
export function calculateCopperPour(pLoss_W: number, maxTemp_C = 100, ambientTemp_C = 25): number {
  const required_Rth = (maxTemp_C - ambientTemp_C) / Math.max(pLoss_W, 0.01)
  if (required_Rth >= 65) return 0   // standard package thermal resistance is sufficient
  const area_in2 = Math.pow(50 / required_Rth, 2)
  return area_in2 * 645.16           // in² → mm²
}
