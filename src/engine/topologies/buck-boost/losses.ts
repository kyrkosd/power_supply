import type { DesignSpec } from '../../types'
import {
  RDS_ON, T_RISE, T_FALL, QG, VF, DCR, ESR, CORE_F,
  RDS_SYNC, T_DEAD, COSS_S, QG_S, VF_BODY,
} from '../../device-assumptions'

// TI SLUA618 eq. 3 for switching losses.
// Sync FET replaces freewheeling diode during (1-D) in synchronous mode.
export function computeBuckBoostLosses(
  spec: DesignSpec,
  dutyCycle: number,
  IL_peak: number,
  IL_rms: number,
  deltaIL: number,
  mosfetVdsMax: number,
  I_cout_rms: number,
  IL_dc: number,
) {
  const { vinMin, iout, fsw } = spec
  const syncMode = spec.rectification === 'synchronous'
  const I_sw_rms = IL_rms * Math.sqrt(dutyCycle)

  const mosfet_conduction = RDS_ON * I_sw_rms ** 2
  const mosfet_switching  = 0.5 * mosfetVdsMax * IL_peak * (T_RISE + T_FALL) * fsw
  const mosfet_gate       = QG * vinMin * fsw

  const inductor_copper = DCR * IL_rms ** 2
  const inductor_core   = CORE_F * IL_dc * deltaIL

  const diode_conduction = syncMode ? 0 : VF * iout * (1 - dutyCycle)
  const sync_conduction  = syncMode ? RDS_SYNC * IL_rms ** 2 * (1 - dutyCycle) : 0
  const sync_dead_time   = syncMode
    ? VF_BODY * IL_dc * 2 * T_DEAD * fsw
      + 0.5 * COSS_S * mosfetVdsMax ** 2 * fsw
      + QG_S * mosfetVdsMax * fsw
    : 0
  const capacitor_esr = I_cout_rms ** 2 * ESR

  return {
    mosfet_conduction, mosfet_switching, mosfet_gate,
    inductor_copper,   inductor_core,
    diode_conduction,  sync_conduction,  sync_dead_time,
    capacitor_esr,
  }
}
