export interface TraceWidthResult {
  width_mm: number;
  width_mils: number;
}

export interface CriticalLoopInfo {
  description: string;
  components: string[];
  placementOrder: string[];
}

/**
 * Calculates the minimum trace width according to the IPC-2221 standard.
 * @param current_A The RMS current in Amperes
 * @param tempRise_C The allowed temperature rise in degrees Celsius (Default: 20)
 * @param thickness_oz Copper thickness in ounces (Default: 1)
 * @param isInternal Whether the trace is on an internal layer
 */
export function calculateTraceWidth(
  current_A: number,
  tempRise_C: number = 20,
  thickness_oz: number = 1,
  isInternal: boolean = false
): TraceWidthResult {
  // IPC-2221 constants
  const k = isInternal ? 0.024 : 0.048;
  const b = 0.44;
  const c = 0.725;

  // Cross-sectional area in square mils
  const area_mils2 = Math.pow(current_A / (k * Math.pow(tempRise_C, b)), 1 / c);
  
  // Width in mils (1 oz copper = ~1.378 mils thickness)
  const width_mils = area_mils2 / (thickness_oz * 1.378);
  
  return {
    width_mils,
    width_mm: width_mils * 0.0254
  };
}

/**
 * Identifies the critical high di/dt loops and component placement rules based on topology.
 */
export function getCriticalLoop(topology: 'buck' | 'boost' | 'flyback' | string): CriticalLoopInfo {
  switch (topology.toLowerCase()) {
    case 'buck':
      return {
        description: 'High di/dt input loop containing the input capacitor, high-side switch, and low-side diode/switch. This loop must be minimized to reduce EMI and ringing.',
        components: ['Cin', 'Q_high', 'D_low (or Q_low)'],
        placementOrder: ['1. Place Cin Kelvin-close to Q_high Drain and D_low Anode (or Q_low Source)', '2. Keep SW node (Q_high Source) extremely short and wide', '3. Place Inductor close to SW node', '4. Place Cout close to Inductor']
      };
    case 'boost':
      return {
        description: 'High di/dt output loop containing the low-side switch, output diode, and output capacitor.',
        components: ['Q_low', 'D_out', 'Cout'],
        placementOrder: ['1. Place Cout Kelvin-close to D_out Cathode and Q_low Source', '2. Keep SW node (Inductor to Q_low/D_out) extremely short', '3. Place Cin close to Inductor', '4. Route Feedback network near control IC, far from SW node']
      };
    case 'flyback':
      return {
        description: 'High di/dt primary loop (Cin, Q_main, Transformer Primary) and secondary loop (Transformer Secondary, D_out, Cout).',
        components: ['Cin', 'Q_main', 'T1_Pri', 'D_out', 'Cout', 'T1_Sec'],
        placementOrder: ['1. Tightly group Cin, Q_main, and T1_Pri', '2. Place Clamp circuit tightly coupled to T1_Pri', '3. Tightly group T1_Sec, D_out, and Cout', '4. Place Y-cap bridging primary/secondary grounds directly under transformer']
      };
    default:
      return {
        description: 'General high di/dt switching loop.',
        components: ['Switch', 'Diode', 'Capacitor'],
        placementOrder: ['1. Minimize high di/dt loop area', '2. Short SW node', '3. Keep feedback away from noisy nodes']
      };
  }
}

/**
 * Estimates required copper area (1oz) to act as a heatsink.
 * Based on heuristic: Rth_ca ≈ 50 / sqrt(Area_in2)
 */
export function calculateCopperPour(pLoss_W: number, maxTemp_C: number = 100, ambientTemp_C: number = 25): number {
  const required_Rth = (maxTemp_C - ambientTemp_C) / Math.max(pLoss_W, 0.01);
  if (required_Rth >= 65) return 0; // Standard package thermal resistance is sufficient without extra pour
  const area_in2 = Math.pow(50 / required_Rth, 2);
  return area_in2 * 645.16; // Convert square inches to square millimeters
}