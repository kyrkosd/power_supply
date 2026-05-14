import type { DesignSpec, DesignResult, FilterComponent } from '../types'
import { fmtH, fmtF, fmtR } from './format'

export function buildFilterComponents(
  spec: DesignSpec,
  result: DesignResult,
  dm_inductor: number,
  dm_capacitor: number,
  damping_resistor: number,
  damping_capacitor: number,
  cm_choke: number,
  x_capacitor: number,
  y_capacitors: number,
): FilterComponent[] {
  const vin_rat = `${(spec.vinMax * 1.5).toFixed(0)} V`
  const vin_max = `${spec.vinMax.toFixed(0)} V`
  const i_pk    = `${result.peakCurrent.toFixed(1)} A`
  const i_rip   = `Irms ≥ ${(result.peakCurrent * 0.3).toFixed(1)} A`
  return [
    { ref: 'Lf',  type: 'DM Inductor',           value: fmtH(dm_inductor),       voltage_rating: vin_rat, current_rating: i_pk },
    { ref: 'Cf',  type: 'DM Capacitor (X2)',      value: fmtF(dm_capacitor),      voltage_rating: vin_rat, current_rating: i_rip },
    { ref: 'Rd',  type: 'Damping Resistor',       value: fmtR(damping_resistor),  voltage_rating: vin_rat, current_rating: i_pk },
    { ref: 'Cd',  type: 'Damping Capacitor (X2)', value: fmtF(damping_capacitor), voltage_rating: vin_rat, current_rating: i_rip },
    { ref: 'Lcm', type: 'CM Choke',               value: fmtH(cm_choke),          voltage_rating: vin_max, current_rating: i_pk },
    { ref: 'Cx',  type: 'X2 Safety Capacitor',    value: fmtF(x_capacitor),       voltage_rating: '275 Vrms (X2)', current_rating: '—' },
    { ref: 'Cy1', type: 'Y2 Safety Capacitor',    value: fmtF(y_capacitors),      voltage_rating: '250 Vrms (Y2)', current_rating: '—' },
    { ref: 'Cy2', type: 'Y2 Safety Capacitor',    value: fmtF(y_capacitors),      voltage_rating: '250 Vrms (Y2)', current_rating: '—' },
  ]
}
