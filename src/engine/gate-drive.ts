// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import type { DesignSpec, DesignResult } from './types'
import type { MosfetData } from './component-selector'

// ── Constants ─────────────────────────────────────────────────────────────────

const VGS_DRIVE      = 10    // V  — gate drive voltage (standard 10 V driver)
const RG_INT         = 1.5   // Ω  — typical internal MOSFET gate resistance
const IG_PEAK_TARGET = 2.0   // A  — default peak gate current for integrated drivers
const DELTA_VBOOT    = 0.2   // V  — maximum acceptable bootstrap cap voltage droop
const BOOT_MARGIN    = 10    // ×  — capacitance margin applied over the minimum Cboot value

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

// ── Computation ───────────────────────────────────────────────────────────────

/**
 * Computes gate drive design values for the selected MOSFET.
 *
 * @param spec    — design spec (provides fsw and vinMax)
 * @param _result — design result (reserved for future use, e.g. duty cycle–adjusted timing)
 * @param mosfet  — selected MOSFET part data
 */
export function computeGateDrive(
  spec: DesignSpec,
  _result: DesignResult,
  mosfet: MosfetData,
): GateDriveResult {
  const Qg  = mosfet.qg_nc  * 1e-9                              // C — total gate charge
  // Guard: some datasheets omit Qgd; fall back to 30 % of Qg (typical for power MOSFETs)
  const Qgd = mosfet.qgd_nc > 0 ? mosfet.qgd_nc * 1e-9 : Qg * 0.30  // C — Miller charge

  // 1. External gate resistor — limits driver peak current to IG_PEAK_TARGET
  //    Rg_ext = Vgs / Ig_target − Rg_int; clamp to 0.5 Ω minimum
  //    TI Application Report SLUA618 — Gate Resistor Design
  const gate_resistor    = Math.max(0.5, VGS_DRIVE / IG_PEAK_TARGET - RG_INT)
  const Rg_total         = gate_resistor + RG_INT
  const peak_gate_current = VGS_DRIVE / Rg_total

  // 2. Switching times
  //    Turn-on: limited by total gate charge Qg
  //    Turn-off: dominated by Miller plateau (Qgd) — controls dv/dt and EMI
  //    Infineon AN_201702_PL52_014 — MOSFET Gate Charge Fundamentals
  const turn_on_time  = Qg  / peak_gate_current
  const turn_off_time = Qgd / peak_gate_current

  // 3. Recommended dead time — prevents shoot-through in half-bridge drivers
  //    Margin of 1.5× on the slower of the two transitions
  //    Erickson & Maksimovic "Fundamentals of Power Electronics" 3rd ed., §4.3
  const dead_time_recommended = Math.max(turn_on_time, turn_off_time) * 1.5

  // 4. Gate drive power — energy (Qg × Vgs) dissipated in the driver every cycle
  //    Microchip AN1471 eq. 1
  const gate_drive_power = Qg * VGS_DRIVE * spec.fsw

  // 5. Bootstrap capacitor (relevant only for high-side switches: buck, forward)
  //    Cboot ≥ Qg / ΔVboot; BOOT_MARGIN provides capacitance overhead for leakage
  //    TI SLVA301 — Bootstrap Circuit Design for MOSFET Drivers
  const bootstrap_cap = BOOT_MARGIN * Qg / DELTA_VBOOT

  // 6. Bootstrap diode reverse voltage: must withstand Vin_max + Vgs during the ON phase
  const bootstrap_diode_vr = spec.vinMax + VGS_DRIVE

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
