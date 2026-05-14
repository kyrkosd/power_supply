// Gate drive design for switching power supply MOSFETs.
// References: TI SLUA618, Infineon AN_201702_PL52_014, Microchip AN1471, TI SLVA301.
import type { DesignSpec, DesignResult } from './types'
import type { MosfetData } from './component-selector'
import { computeSwitchingTimes, computeBootstrap } from './gate-drive/helpers'

const VGS_DRIVE      = 10    // V  — gate drive voltage
const RG_INT         = 1.5   // Ω  — typical internal gate resistance
const IG_PEAK_TARGET = 2.0   // A  — default peak gate current
const DELTA_VBOOT    = 0.2   // V  — max acceptable bootstrap cap voltage droop
const BOOT_MARGIN    = 10    // ×  — capacitance margin over minimum Cboot

export interface GateDriveResult {
  gate_resistor:          number   // Ω
  bootstrap_cap:          number   // F
  bootstrap_diode_vr:     number   // V
  gate_drive_power:       number   // W
  peak_gate_current:      number   // A
  turn_on_time:           number   // s
  turn_off_time:          number   // s
  dead_time_recommended:  number   // s
}

export function computeGateDrive(spec: DesignSpec, _result: DesignResult, mosfet: MosfetData): GateDriveResult {
  const Qg  = mosfet.qg_nc * 1e-9
  const Qgd = mosfet.qgd_nc > 0 ? mosfet.qgd_nc * 1e-9 : Qg * 0.30
  const gate_resistor     = Math.max(0.5, VGS_DRIVE / IG_PEAK_TARGET - RG_INT)
  const peak_gate_current = VGS_DRIVE / (gate_resistor + RG_INT)
  const gate_drive_power  = Qg * VGS_DRIVE * spec.fsw
  const { turn_on_time, turn_off_time, dead_time_recommended } = computeSwitchingTimes(Qg, Qgd, peak_gate_current)
  const { bootstrap_cap, bootstrap_diode_vr } = computeBootstrap(spec.vinMax, Qg, VGS_DRIVE, BOOT_MARGIN, DELTA_VBOOT)
  return { gate_resistor, bootstrap_cap, bootstrap_diode_vr, gate_drive_power, peak_gate_current, turn_on_time, turn_off_time, dead_time_recommended }
}
