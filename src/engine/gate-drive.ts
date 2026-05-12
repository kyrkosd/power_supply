// Gate drive design for switching power supply MOSFETs.
// References: TI SLUA618, Infineon AN_201702_PL52_014, Microchip AN1471, TI SLVA301.
import type { DesignSpec, DesignResult } from './types'
import type { MosfetData } from './component-selector'

// ── Constants ─────────────────────────────────────────────────────────────────

const VGS_DRIVE      = 10    // V  — gate drive voltage (standard 10 V driver)
const RG_INT         = 1.5   // Ω  — typical internal MOSFET gate resistance
const IG_PEAK_TARGET = 2.0   // A  — default peak gate current for integrated drivers
const DELTA_VBOOT    = 0.2   // V  — maximum acceptable bootstrap cap voltage droop
const BOOT_MARGIN    = 10    // ×  — capacitance margin over minimum Cboot for leakage

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GateDriveResult {
  gate_resistor: number          // Ω  — external resistor to limit peak gate current
  bootstrap_cap: number          // F  — high-side bootstrap capacitor
  bootstrap_diode_vr: number     // V  — minimum reverse voltage rating for bootstrap diode
  gate_drive_power: number       // W  — power dissipated charging/discharging the gate each cycle
  peak_gate_current: number      // A  — Vgs / (Rg_ext + Rg_int)
  turn_on_time: number           // s  — time to charge gate through total Qg
  turn_off_time: number          // s  — time to discharge Miller charge (Qgd-dominated)
  dead_time_recommended: number  // s  — shoot-through prevention margin
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute gate switching times and recommended dead time.
 * Turn-on is limited by total gate charge Qg; turn-off by Miller charge Qgd.
 * Reference: Infineon AN_201702_PL52_014 — MOSFET Gate Charge Fundamentals.
 */
function computeSwitchingTimes(Qg: number, Qgd: number, peak_gate_current: number) {
  const turn_on_time  = Qg  / peak_gate_current
  const turn_off_time = Qgd / peak_gate_current
  // 1.5× margin on the slower transition prevents shoot-through (Erickson §4.3)
  const dead_time_recommended = Math.max(turn_on_time, turn_off_time) * 1.5
  return { turn_on_time, turn_off_time, dead_time_recommended }
}

/**
 * Compute bootstrap capacitor and diode requirements.
 * Relevant only for high-side switches (buck, forward topology).
 * Reference: TI SLVA301 — Bootstrap Circuit Design for MOSFET Drivers.
 */
function computeBootstrap(vinMax: number, Qg: number) {
  const bootstrap_cap      = BOOT_MARGIN * Qg / DELTA_VBOOT
  const bootstrap_diode_vr = vinMax + VGS_DRIVE
  return { bootstrap_cap, bootstrap_diode_vr }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute gate drive design values for the selected MOSFET.
 *
 * @param spec    — design spec (provides fsw and vinMax)
 * @param _result — design result (reserved for future use)
 * @param mosfet  — selected MOSFET part data
 */
export function computeGateDrive(
  spec: DesignSpec,
  _result: DesignResult,
  mosfet: MosfetData,
): GateDriveResult {
  const Qg  = mosfet.qg_nc * 1e-9
  // Guard: some datasheets omit Qgd; fall back to 30 % of Qg (typical for power MOSFETs)
  const Qgd = mosfet.qgd_nc > 0 ? mosfet.qgd_nc * 1e-9 : Qg * 0.30

  // Rg_ext = Vgs / Ig_target − Rg_int; clamp to 0.5 Ω minimum (TI SLUA618)
  const gate_resistor     = Math.max(0.5, VGS_DRIVE / IG_PEAK_TARGET - RG_INT)
  const peak_gate_current = VGS_DRIVE / (gate_resistor + RG_INT)

  const { turn_on_time, turn_off_time, dead_time_recommended } =
    computeSwitchingTimes(Qg, Qgd, peak_gate_current)

  // Gate drive power — energy (Qg × Vgs) dissipated in the driver each cycle (Microchip AN1471 eq. 1)
  const gate_drive_power = Qg * VGS_DRIVE * spec.fsw

  const { bootstrap_cap, bootstrap_diode_vr } = computeBootstrap(spec.vinMax, Qg)

  return {
    gate_resistor,
    bootstrap_cap,
    bootstrap_diode_vr,
    gate_drive_power,
    peak_gate_current,
    turn_on_time,
    turn_off_time,
    dead_time_recommended,
  }
}
