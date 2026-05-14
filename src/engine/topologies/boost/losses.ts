import type { DesignSpec } from '../../types'
import {
  RDS_ON, T_RISE, T_FALL, QG, VF, DCR, ESR, CORE_F,
  RDS_SYNC, T_DEAD, COSS_S, QG_S, VF_BODY,
} from '../../device-assumptions'

// TI SLUA618 eq. 3 for MOSFET switching losses.
// Control MOSFET conducts during D; output diode / sync FET conducts during (1-D).
export function computeBoostLosses(
  spec: DesignSpec,
  dutyCycle: number,
  inputCurrent: number,
  deltaIL: number,
  peakCurrent: number,
) {
  const { vinMin, vout, iout, fsw } = spec
  const syncMode = spec.rectification === 'synchronous'
  const I_L_rms  = Math.sqrt(inputCurrent ** 2 + deltaIL ** 2 / 12)

  const mosfet_conduction = RDS_ON * I_L_rms ** 2 * dutyCycle
  const mosfet_switching  = 0.5 * vinMin * peakCurrent * (T_RISE + T_FALL) * fsw
  const mosfet_gate       = QG * vout * fsw

  const inductor_copper = DCR * I_L_rms ** 2
  const inductor_core   = CORE_F * inputCurrent * deltaIL

  const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)
  const sync_conduction  = syncMode ? RDS_SYNC * I_L_rms ** 2 * (1 - dutyCycle) : 0
  const sync_dead_time   = syncMode
    ? VF_BODY * inputCurrent * 2 * T_DEAD * fsw
      + 0.5 * COSS_S * vout ** 2 * fsw
      + QG_S * vout * fsw
    : 0

  const Ic_rms        = iout * Math.sqrt(dutyCycle / (1 - dutyCycle))
  const capacitor_esr = Ic_rms ** 2 * ESR

  return {
    mosfet_conduction, mosfet_switching, mosfet_gate,
    inductor_copper,   inductor_core,
    diode_conduction,  sync_conduction,  sync_dead_time,
    capacitor_esr,
  }
}
