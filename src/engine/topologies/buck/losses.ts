// Buck converter loss breakdown.
// TI SLUA618 for MOSFET switching loss; Erickson & Maksimovic §4.3 for sync FET.

import type { DesignSpec } from '../../types'
import { DEVICE_ASSUMPTIONS } from '../../device-assumptions'

const {
  rds_on:      RDS_ON,
  t_rise:      T_RISE,
  t_fall:      T_FALL,
  qg:          QG,
  vf:          VF,
  dcr:         DCR,
  esr:         ESR,
  core_factor: CORE_FACTOR,
  rds_on_sync: RDS_ON_SYNC,
  t_dead:      T_DEAD,
  coss_sync:   COSS_SYNC,
  qg_sync:     QG_SYNC,
  vf_body:     VF_BODY,
} = DEVICE_ASSUMPTIONS

export interface BuckLossInputs {
  dutyCycle: number
  N: number
  I_phase_avg: number
  peak_phase: number
  deltaIL_phase: number
  K_out: number
}

export interface BuckLosses {
  mosfet_conduction: number
  mosfet_switching:  number
  mosfet_gate:       number
  inductor_copper:   number
  inductor_core:     number
  diode_conduction:  number
  sync_conduction:   number
  sync_dead_time:    number
  capacitor_esr:     number
}

function syncFetLosses(
  vinMax: number, fsw: number, dutyCycle: number, N: number,
  I_phase_avg: number, I_L_rms: number,
): { sync_conduction: number; sync_dead_time: number } {
  return {
    sync_conduction: N * RDS_ON_SYNC * I_L_rms ** 2 * (1 - dutyCycle),
    sync_dead_time:  N * (VF_BODY * I_phase_avg * 2 * T_DEAD * fsw
                       + 0.5 * COSS_SYNC * vinMax ** 2 * fsw
                       + QG_SYNC * vinMax * fsw),
  }
}

/** Buck loss breakdown, scaled across N interleaved phases. */
export function computeBuckLosses(spec: DesignSpec, inputs: BuckLossInputs): BuckLosses {
  const { vinMax, iout, fsw } = spec
  const { dutyCycle, N, I_phase_avg, peak_phase, deltaIL_phase, K_out } = inputs
  const syncMode   = spec.rectification === 'synchronous'
  const I_L_rms    = Math.sqrt(I_phase_avg ** 2 + deltaIL_phase ** 2 / 12)
  const Ic_out_rms = (K_out * deltaIL_phase) / (2 * Math.sqrt(3))

  const mosfet_conduction = RDS_ON * iout ** 2 * dutyCycle / N
  const mosfet_switching  = N * 0.5 * vinMax * peak_phase * (T_RISE + T_FALL) * fsw
  const mosfet_gate       = N * QG * vinMax * fsw

  const inductor_copper = N * DCR * I_L_rms ** 2
  const inductor_core   = N * CORE_FACTOR * I_phase_avg * deltaIL_phase

  const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)
  const { sync_conduction, sync_dead_time } = syncMode
    ? syncFetLosses(vinMax, fsw, dutyCycle, N, I_phase_avg, I_L_rms)
    : { sync_conduction: 0, sync_dead_time: 0 }

  return {
    mosfet_conduction, mosfet_switching, mosfet_gate,
    inductor_copper,   inductor_core,
    diode_conduction,  sync_conduction, sync_dead_time,
    capacitor_esr: Ic_out_rms ** 2 * ESR,
  }
}

export function sumLosses(l: BuckLosses): number {
  return l.mosfet_conduction + l.mosfet_switching + l.mosfet_gate
       + l.inductor_copper   + l.inductor_core    + l.diode_conduction
       + l.sync_conduction   + l.sync_dead_time   + l.capacitor_esr
}
