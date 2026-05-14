// Gate switching time and bootstrap calculations.
// References: Infineon AN_201702_PL52_014; TI SLVA301.

export interface SwitchingTimes {
  turn_on_time:          number   // s
  turn_off_time:         number   // s
  dead_time_recommended: number   // s
}

export function computeSwitchingTimes(Qg: number, Qgd: number, peak_gate_current: number): SwitchingTimes {
  const turn_on_time  = Qg  / peak_gate_current
  const turn_off_time = Qgd / peak_gate_current
  return { turn_on_time, turn_off_time, dead_time_recommended: Math.max(turn_on_time, turn_off_time) * 1.5 }
}

export function computeBootstrap(vinMax: number, Qg: number, vgs: number, margin: number, droop: number) {
  return { bootstrap_cap: margin * Qg / droop, bootstrap_diode_vr: vinMax + vgs }
}
